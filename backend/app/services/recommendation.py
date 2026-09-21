from app.db.mongodb import get_database
from bson import ObjectId
from typing import List, Dict, Any

class RecommendationService:
    @staticmethod
    async def get_recommendations(student_id: str, course_id: str) -> List[Dict[str, Any]]:
        """
        Generates smart learning recommendations based on the student's concept mastery profile.
        """
        db = get_database()
        
        # 1. Retrieve user progress
        progress = await db.user_progress.find_one({
            "student_id": ObjectId(student_id),
            "course_id": ObjectId(course_id)
        })
        
        if not progress or not progress.get("topics"):
            return [
                {
                    "type": "explore",
                    "topic": "Welcome",
                    "message": "Welcome to the course! Start by reading the uploaded course materials and lectures.",
                    "action": "view_materials",
                    "difficulty": "easy"
                }
            ]
            
        topics = progress["topics"]
        
        # Retrieve materials for metadata lookup
        cursor = db.materials.find({"course_id": course_id})
        materials = await cursor.to_list(length=100)
        
        recommendations = []
        
        # Group topics by mastery levels
        weak_topics = []      # Mastery < 0.70
        advancing_topics = [] # 0.70 <= Mastery < 0.85
        mastered_topics = []  # Mastery >= 0.85
        
        for topic_name, data in topics.items():
            prob = data.get("mastery_probability", 0.25)
            if prob < 0.70:
                weak_topics.append((topic_name, prob))
            elif prob < 0.85:
                advancing_topics.append((topic_name, prob))
            else:
                mastered_topics.append((topic_name, prob))
                
        # Sort lists by mastery probability
        weak_topics.sort(key=lambda x: x[1])
        advancing_topics.sort(key=lambda x: x[1])
        
        # 2. Rule-Based Recommendation Engine
        # Rule A: Prioritize weak topics (<70% mastery) - recommend reviewing notes first
        for topic, prob in weak_topics[:2]: # Max 2 weak recommendations
            # Find a matching material if any
            matched_mat = None
            for m in materials:
                if topic.lower() in m.get("title", "").lower():
                    matched_mat = str(m["_id"])
                    break
            if not matched_mat and materials:
                matched_mat = str(materials[0]["_id"])
                
            recommendations.append({
                "type": "review",
                "topic": topic,
                "message": f"Your concept mastery in '{topic}' is low ({int(prob*100)}%). We recommend reviewing the lecture materials before taking another practice quiz.",
                "action": "view_material",
                "resource_id": matched_mat,
                "difficulty": "easy"
            })
            
        # Rule B: Advancing topics (70% - 85% mastery) - recommend taking medium quizzes to bridge the gap
        for topic, prob in advancing_topics[:2]:
            recommendations.append({
                "type": "practice",
                "topic": topic,
                "message": f"You are building strength in '{topic}' ({int(prob*100)}% mastery). Practice with a Medium difficulty quiz to achieve full mastery.",
                "action": "take_quiz",
                "resource_id": None,
                "difficulty": "medium"
            })
            
        # Rule C: Mastered topics (>=85% mastery) - recommend challenging hard quizzes or exploring next chapters
        if mastered_topics and not weak_topics:
            for topic, prob in mastered_topics[:1]:
                recommendations.append({
                    "type": "challenge",
                    "topic": topic,
                    "message": f"Excellent! You have mastered '{topic}' ({int(prob*100)}% mastery). Take a Hard difficulty quiz to challenge yourself!",
                    "action": "take_quiz",
                    "resource_id": None,
                    "difficulty": "hard"
                })
                
        # If everything is mastered, recommend checking out general updates
        if not recommendations:
            recommendations.append({
                "type": "explore",
                "topic": "Ahead of Schedule",
                "message": "Incredible! You have completed all active topic masteries. Stay tuned for new faculty materials.",
                "action": "view_materials",
                "difficulty": "hard"
            })
            
        return recommendations
