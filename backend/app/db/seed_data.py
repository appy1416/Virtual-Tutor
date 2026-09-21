import asyncio
from bson import ObjectId
from app.services.auth_service import hash_password
from app.db.mongodb import get_database

async def seed_real_database():
    db = get_database()
    print("Verifying database curriculum taxonomy...")

    # 1. Seed Subjects & Topics
    subjects_count = await db.subjects.count_documents({})
    if subjects_count == 0:
        await db.subjects.drop()
        await db.topics.drop()

        real_subjects = [
            {
                "name": "Java Programming",
                "description": "Comprehensive Object-Oriented Programming and Enterprise Application Development in Java.",
                "topics": [
                    {
                        "name": "Java Fundamentals & Syntax",
                        "description": "JDK, JRE, JVM architecture, variables, primitive types, and operators.",
                        "subtopics": ["JVM Architecture", "Data Types", "Operators", "Input/Output Streams"]
                    },
                    {
                        "name": "Control Flow & Decision Making",
                        "description": "Conditional branching logic and iteration constructs in Java.",
                        "subtopics": ["if-else", "switch expression", "for loop", "while loop", "do-while"]
                    },
                    {
                        "name": "Object-Oriented Programming Core",
                        "description": "Classes, inheritance, polymorphism, encapsulation, abstraction, and interfaces.",
                        "subtopics": ["Classes & Objects", "Inheritance", "Polymorphism", "Encapsulation", "Abstraction", "Interfaces"]
                    },
                    {
                        "name": "Exception Handling & Robustness",
                        "description": "Try-catch-finally mechanisms, custom exceptions, and assertions.",
                        "subtopics": ["Try-Catch-Finally", "Throw vs Throws", "Custom Exception Classes"]
                    },
                    {
                        "name": "Java Collections Framework",
                        "description": "Lists, Sets, Maps, Queues, and Iterator patterns.",
                        "subtopics": ["ArrayList & LinkedList", "HashSet & TreeSet", "HashMap & ConcurrentHashMap", "Collections Utility"]
                    },
                    {
                        "name": "Advanced Java & Streams",
                        "description": "Generics, Multithreading, Concurrency, File I/O, JDBC, and Lambda Expressions.",
                        "subtopics": ["Generics", "File I/O", "Multithreading & Executors", "JDBC Database Access", "Java 8 Streams"]
                    }
                ]
            },
            {
                "name": "Python Programming",
                "description": "Modern Python for Data Science, Automation, Web APIs, and Artificial Intelligence.",
                "topics": [
                    {
                        "name": "Python Syntax & Basics",
                        "description": "Dynamic typing, variables, expressions, and formatting.",
                        "subtopics": ["Variables & Primitive Types", "Strings & Formatting", "Basic Operators"]
                    },
                    {
                        "name": "Data Structures in Python",
                        "description": "Built-in lists, tuples, dictionaries, sets, and comprehension syntax.",
                        "subtopics": ["Lists & Mutability", "Tuples", "Dictionaries & Hash Keys", "Sets", "List & Dict Comprehensions"]
                    },
                    {
                        "name": "Functional & Modular Programming",
                        "description": "Functions, args/kwargs, modules, packages, and lambda functions.",
                        "subtopics": ["Function Definitions", "*args & **kwargs", "Lambda Functions", "Modules & Imports"]
                    },
                    {
                        "name": "Object-Oriented Python",
                        "description": "Classes, dunder methods, inheritance, and dataclasses.",
                        "subtopics": ["Classes & Self", "Special Dunder Methods", "Inheritance", "Dataclasses"]
                    },
                    {
                        "name": "File I/O & Exception Handling",
                        "description": "Context managers, reading/writing files, and error handling.",
                        "subtopics": ["Try-Except Blocks", "Context Managers (with statement)", "JSON & File I/O"]
                    }
                ]
            },
            {
                "name": "Data Structures & Algorithms",
                "description": "Fundamental algorithms, time/space complexity analysis, and linear/non-linear data structures.",
                "topics": [
                    {
                        "name": "Complexity Analysis & Asymptotic Notation",
                        "description": "Big-O, Big-Omega, Big-Theta notation, and recursion trees.",
                        "subtopics": ["Big-O Complexity", "Space Complexity", "Recurrence Relations"]
                    },
                    {
                        "name": "Linear Data Structures",
                        "description": "Arrays, Linked Lists, Stacks, Queues, and Deques.",
                        "subtopics": ["Arrays & Dynamic Arrays", "Singly & Doubly Linked Lists", "Stack Applications", "Queue Implementations"]
                    },
                    {
                        "name": "Sorting & Searching Algorithms",
                        "description": "Binary search, QuickSort, MergeSort, HeapSort, and Counting Sort.",
                        "subtopics": ["Binary Search", "MergeSort", "QuickSort", "HeapSort"]
                    },
                    {
                        "name": "Tree Data Structures",
                        "description": "Binary Trees, Binary Search Trees (BST), AVL Trees, and Heaps.",
                        "subtopics": ["Binary Tree Traversals", "BST Operations", "Balanced Trees (AVL)", "Binary Heaps"]
                    },
                    {
                        "name": "Graph Algorithms",
                        "description": "Breadth-First Search (BFS), Depth-First Search (DFS), Dijkstra's, and Kruskal's algorithm.",
                        "subtopics": ["Graph Representation", "BFS & DFS", "Shortest Path (Dijkstra)", "Minimum Spanning Tree"]
                    }
                ]
            },
            {
                "name": "Database Management Systems (DBMS)",
                "description": "Relational databases, SQL queries, ER modeling, normalization, and ACID transactions.",
                "topics": [
                    {
                        "name": "Relational Model & SQL Fundamentals",
                        "description": "DDL, DML, DCL commands, SELECT queries, and JOINs.",
                        "subtopics": ["CREATE/ALTER Table", "SELECT, WHERE, ORDER BY", "INNER, LEFT, RIGHT JOINs", "Aggregation & GROUP BY"]
                    },
                    {
                        "name": "Database Design & Normalization",
                        "description": "ER Diagrams, 1NF, 2NF, 3NF, and BCNF normal forms.",
                        "subtopics": ["Entity-Relationship Models", "Functional Dependencies", "1NF & 2NF", "3NF & BCNF"]
                    },
                    {
                        "name": "Transactions & Concurrency Control",
                        "description": "ACID properties, locking mechanisms, serializability, and deadlock handling.",
                        "subtopics": ["ACID Properties", "Two-Phase Locking (2PL)", "Deadlock Detection & Prevention"]
                    }
                ]
            }
        ]

        for s_data in real_subjects:
            topics_list = s_data.pop("topics", [])
            s_obj = {
                "name": s_data["name"],
                "description": s_data["description"]
            }
            res = await db.subjects.insert_one(s_obj)
            subject_id = res.inserted_id

            for t_idx, t_data in enumerate(topics_list):
                t_obj = {
                    "subject_id": subject_id,
                    "name": t_data["name"],
                    "description": t_data["description"],
                    "subtopics": t_data.get("subtopics", []),
                    "order": t_idx + 1
                }
                await db.topics.insert_one(t_obj)

        print(f"Loaded {len(real_subjects)} curriculum subjects into database.")
    print("Database Engine Ready: Live User & Class System Active.")

if __name__ == "__main__":
    asyncio.run(seed_real_database())
