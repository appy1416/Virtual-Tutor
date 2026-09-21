import os
import json
import asyncio
from bson import ObjectId
from typing import List, Dict, Any, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")

from datetime import datetime, date

def json_encoder(obj):
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

class InsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id

class InsertManyResult:
    def __init__(self, ids):
        self.inserted_ids = ids

class UpdateResult:
    def __init__(self, matched_count: int = 0, modified_count: int = 0):
        self.matched_count = matched_count
        self.modified_count = modified_count

class UpdateManyResult(UpdateResult):
    pass

class DeleteResult:
    def __init__(self, deleted_count: int = 0):
        self.deleted_count = deleted_count

class PersistentCollection:
    def __init__(self, name: str, data_dir: str = DATA_DIR):
        self.name = name
        self.data_dir = data_dir
        os.makedirs(self.data_dir, exist_ok=True)
        self.file_path = os.path.join(self.data_dir, f"{name}.json")
        self.store: List[Dict[str, Any]] = self._load()

    def _load(self) -> List[Dict[str, Any]]:
        if os.path.exists(self.file_path):
            try:
                with open(self.file_path, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
                    for item in raw_data:
                        if "_id" in item and isinstance(item["_id"], str):
                            try:
                                item["_id"] = ObjectId(item["_id"])
                            except Exception:
                                pass
                    return raw_data
            except Exception as e:
                print(f"Error loading {self.file_path}: {e}")
                return []
        return []

    def _save(self):
        try:
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(self.store, f, indent=2, default=json_encoder)
        except Exception as e:
            print(f"Error saving {self.file_path}: {e}")

    async def drop(self):
        self.store = []
        if os.path.exists(self.file_path):
            try:
                os.remove(self.file_path)
            except Exception:
                pass

    def _match_val(self, item_val, target_val) -> bool:
        if isinstance(item_val, ObjectId):
            item_val = str(item_val)
        if isinstance(target_val, ObjectId):
            target_val = str(target_val)

        # Handle list/array fields in stored documents (e.g. student_ids, subject_ids)
        if isinstance(item_val, list):
            norm_items = [str(elem) if isinstance(elem, ObjectId) else elem for elem in item_val]
            if isinstance(target_val, dict):
                if "$in" in target_val:
                    target_list = [str(tgt) if isinstance(tgt, ObjectId) else tgt for tgt in target_val["$in"]]
                    for item_elem in norm_items:
                        if item_elem in target_list:
                            return True
                    return False
                if "$ne" in target_val:
                    ne_val = str(target_val["$ne"]) if isinstance(target_val["$ne"], ObjectId) else target_val["$ne"]
                    return ne_val not in norm_items
            target_str = str(target_val) if isinstance(target_val, ObjectId) else target_val
            return target_str in norm_items or target_val == item_val

        # Handle operators on scalar fields
        if isinstance(target_val, dict):
            if "$in" in target_val:
                target_list = [str(tgt) if isinstance(tgt, ObjectId) else tgt for tgt in target_val["$in"]]
                return item_val in target_list
            if "$gte" in target_val:
                return item_val is not None and item_val >= target_val["$gte"]
            if "$lte" in target_val:
                return item_val is not None and item_val <= target_val["$lte"]
            if "$ne" in target_val:
                ne_val = str(target_val["$ne"]) if isinstance(target_val["$ne"], ObjectId) else target_val["$ne"]
                return item_val != ne_val
        return item_val == target_val

    def _match_query(self, item: Dict[str, Any], query: Optional[Dict[str, Any]]) -> bool:
        if not query:
            return True
        for k, v in query.items():
            if k == "$or" and isinstance(v, list):
                if not any(self._match_query(item, cond) for cond in v):
                    return False
                continue
            if k == "$and" and isinstance(v, list):
                if not all(self._match_query(item, cond) for cond in v):
                    return False
                continue
            item_val = item.get(k)
            if not self._match_val(item_val, v):
                return False
        return True

    async def find_one(self, query=None, projection=None):
        for item in self.store:
            if self._match_query(item, query):
                res = item.copy()
                return res
        return None

    async def insert_one(self, doc):
        doc = doc.copy()
        if "_id" not in doc or not doc["_id"]:
            doc["_id"] = ObjectId()
        elif isinstance(doc["_id"], str):
            try:
                doc["_id"] = ObjectId(doc["_id"])
            except Exception:
                pass
        self.store.append(doc)
        self._save()
        return InsertResult(doc["_id"])

    async def insert_many(self, docs):
        inserted_ids = []
        for doc in docs:
            doc = doc.copy()
            if "_id" not in doc or not doc["_id"]:
                doc["_id"] = ObjectId()
            self.store.append(doc)
            inserted_ids.append(doc["_id"])
        self._save()
        return InsertManyResult(inserted_ids)

    async def update_one(self, query, update, upsert=False):
        doc = None
        for item in self.store:
            if self._match_query(item, query):
                doc = item
                break
        if not doc and upsert:
            doc = query.copy() if query else {}
            doc["_id"] = ObjectId()
            self.store.append(doc)

        if doc:
            if "$push" in update:
                for k, v in update["$push"].items():
                    if k not in doc or not isinstance(doc[k], list):
                        doc[k] = []
                    doc[k].append(v)
            if "$set" in update:
                for k, v in update["$set"].items():
                    doc[k] = v
            if "$inc" in update:
                for k, v in update["$inc"].items():
                    doc[k] = doc.get(k, 0) + v
            self._save()

        return UpdateResult(1 if doc else 0, 1 if doc else 0)

    async def update_many(self, query, update, upsert=False):
        modified_count = 0
        for item in self.store:
            if self._match_query(item, query):
                modified_count += 1
                if "$set" in update:
                    for sk, sv in update["$set"].items():
                        item[sk] = sv
                if "$inc" in update:
                    for ik, iv in update["$inc"].items():
                        item[ik] = item.get(ik, 0) + iv
        if modified_count > 0:
            self._save()

        return UpdateManyResult(modified_count, modified_count)

    async def delete_one(self, query):
        for idx, item in enumerate(self.store):
            if self._match_query(item, query):
                self.store.pop(idx)
                self._save()
                return DeleteResult(1)
        return DeleteResult(0)

    async def delete_many(self, query):
        initial_len = len(self.store)
        self.store = [item for item in self.store if not self._match_query(item, query)]
        deleted_count = initial_len - len(self.store)
        if deleted_count > 0:
            self._save()
        return DeleteResult(deleted_count)

    async def count_documents(self, query=None):
        if not query:
            return len(self.store)
        return sum(1 for item in self.store if self._match_query(item, query))

    def find(self, query=None):
        parent = self
        class PersistentCursor:
            def __init__(self, data):
                self.data = data
            def sort(self, key, direction=1):
                try:
                    def sort_key(x):
                        val = x.get(key)
                        if val is None:
                            return ""
                        if isinstance(val, (datetime, date)):
                            return val.isoformat()
                        return str(val)
                    self.data.sort(key=sort_key, reverse=(direction == -1))
                except Exception:
                    pass
                return self
            async def to_list(self, length):
                return [d.copy() for d in self.data[:length]]

        matched = [item for item in self.store if parent._match_query(item, query)]
        return PersistentCursor(matched)

class PersistentDatabase:
    def __init__(self, data_dir: str = DATA_DIR):
        self.data_dir = data_dir
        self.collections: Dict[str, PersistentCollection] = {}

    def __getattr__(self, name: str) -> PersistentCollection:
        if name not in self.collections:
            self.collections[name] = PersistentCollection(name, self.data_dir)
        return self.collections[name]

    def __getitem__(self, name: str) -> PersistentCollection:
        return self.__getattr__(name)
