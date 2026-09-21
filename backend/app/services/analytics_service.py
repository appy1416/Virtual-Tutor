from app.db.mongodb import get_database
from bson import ObjectId
from typing import Dict, Any, List
from datetime import datetime

class AnalyticsService:
    @staticmethod
    async def get_student_analytics(student_id: str, course_id: Any = None) -> Dict[str, Any]:
        """
        Computes simplified learning analytics for the student dashboard.
        """
        db = get_database()
        
        # 1. Fetch Student profile
        student = await db.users.find_one({"_id": ObjectId(student_id)})
        student_name = student.get("name", "Student") if student else "Student"
        
        # 2. Count total subjects
        total_subjects = await db.subjects.count_documents({})
        
        # 3. Count total topics
        total_topics = await db.topics.count_documents({})
        
        # 4. Fetch all quiz results for this student
        cursor = db.quiz_results.find({"user_id": ObjectId(student_id)})
        results = await cursor.to_list(length=200)
        
        # Determine unique completed topics (highest score >= 4 out of 5, which is >= 80%)
        completed_topic_ids = set()
        topic_highest_scores = {}
        
        for r in results:
            t_id = str(r.get("topic_id", ""))
            score = r.get("score", 0)
            if score >= 4 and t_id:
                completed_topic_ids.add(t_id)
            if t_id:
                topic_highest_scores[t_id] = max(topic_highest_scores.get(t_id, 0), score)
            
        completed_topics_count = len(completed_topic_ids)
        
        # 5. Average Quiz Score
        if results:
            avg_score = sum(r.get("percentage", 0.0) for r in results) / len(results)
        else:
            avg_score = 0.0
            
        # 6. Learning Progress (%)
        progress_percentage = round((completed_topics_count / total_topics * 100.0), 1) if total_topics > 0 else 0.0
        
        # 7. Generate "Recommended for You" list
        recommendations = []
        
        # Fetch the most recent 3 quiz results to make it dynamic
        recent_cursor = db.quiz_results.find({"user_id": ObjectId(student_id)}).sort("created_at", -1)
        recent_results = await recent_cursor.to_list(length=3)
        
        for res in recent_results:
            t_id = res["topic_id"]
            score = res["score"]
            topic = await db.topics.find_one({"_id": ObjectId(t_id)})
            
            if topic:
                topic_name = topic["name"]
                if score < 3:
                    recommendations.append({
                        "type": "review",
                        "topic": topic_name,
                        "message": f"Revise '{topic_name}'",
                        "description": "Your quiz score was below 60%. We recommend revising the core concepts.",
                        "action": "/ai-tutor"
                    })
                elif score == 3:
                    recommendations.append({
                        "type": "practice",
                        "topic": topic_name,
                        "message": f"Practice '{topic_name}'",
                        "description": "Solid start! We recommend taking another quiz to master the topic.",
                        "action": "/quiz"
                    })
                else:  # score >= 4
                    # Recommend the next topic
                    subj_id = topic.get("subject_id")
                    if subj_id:
                        all_topics_cursor = db.topics.find({"subject_id": ObjectId(subj_id)})
                        all_topics = await all_topics_cursor.to_list(length=100)
                        
                        current_idx = -1
                        for idx, t in enumerate(all_topics):
                            if str(t["_id"]) == str(t_id):
                                current_idx = idx
                                break
                                
                        if current_idx != -1 and current_idx + 1 < len(all_topics):
                            next_topic = all_topics[current_idx + 1]
                            recommendations.append({
                                "type": "explore",
                                "topic": next_topic["name"],
                                "message": f"Learn '{next_topic['name']}'",
                                "description": f"Excellent job! You are ready to learn the next topic in this subject.",
                                "action": f"/subjects"
                            })
                            
        # If no recommendation exists, show general learning recommendations
        if not recommendations:
            recommendations = [
                {
                    "type": "practice",
                    "topic": "Introduction to Java",
                    "message": "Take Java Quiz",
                    "description": "Kickstart your learning by testing your basic Java programming skills.",
                    "action": "/quiz"
                },
                {
                    "type": "explore",
                    "topic": "OOPs Concepts",
                    "message": "Study OOPs Concepts",
                    "description": "Read through the principles of Encapsulation and Polymorphism.",
                    "action": "/subjects"
                },
                {
                    "type": "review",
                    "topic": "Binary Trees",
                    "message": "Ask AI about Trees",
                    "description": "Ask the AI Tutor to explain Tree Traversal algorithms.",
                    "action": "/ai-tutor"
                }
            ]
            
        # Calculate study streak
        streak_count = 0
        try:
            completed_plans_cursor = db.study_plans.find({
                "student_id": ObjectId(student_id),
                "completed_at": {"$ne": None}
            })
            completed_plans = await completed_plans_cursor.to_list(length=100)
            if completed_plans:
                from datetime import date, timedelta
                completed_dates = set()
                for p in completed_plans:
                    try:
                        p_date = datetime.strptime(p["date"], "%Y-%m-%d").date()
                        completed_dates.add(p_date)
                    except Exception:
                        pass
                today_val = date.today()
                yesterday_val = today_val - timedelta(days=1)
                
                curr = today_val
                if curr not in completed_dates:
                    curr = yesterday_val
                
                while curr in completed_dates:
                    streak_count += 1
                    curr -= timedelta(days=1)
        except Exception as e:
            print(f"Error calculating streak: {e}")

        return {
            "student_name": student_name,
            "total_subjects": total_subjects,
            "completed_topics_count": completed_topics_count,
            "average_quiz_score": round(avg_score, 1),
            "progress_percentage": progress_percentage,
            "streak_count": streak_count,
            "recommendations": recommendations[:3] # Limit to 3 items
        }
