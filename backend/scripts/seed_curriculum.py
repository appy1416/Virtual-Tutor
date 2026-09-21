import os
import sys
import asyncio
from datetime import datetime, timezone

# Add parent directory to sys.path so we can import from app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.mongodb import connect_to_mongo, get_database, close_mongo_connection
from bson import ObjectId

SEEDED_SUBJECTS = [
    {
        "name": "Java",
        "description": "Object-Oriented Programming and application development using Java.",
        "topics": [
            {
                "name": "Java Basics",
                "description": "Fundamental components of Java language including JDK/JRE structure and variables.",
                "subtopics": ["Variables", "Data Types", "Operators", "Input and Output"]
            },
            {
                "name": "Control Statements",
                "description": "Decision-making and looping structures in Java.",
                "subtopics": ["if-else", "switch", "for loop", "while loop", "do-while"]
            },
            {
                "name": "Object-Oriented Programming",
                "description": "Core concepts of OOP: Classes, inheritance, polymorphism, encapsulation, and abstraction.",
                "subtopics": ["Classes and Objects", "Inheritance", "Polymorphism", "Encapsulation", "Abstraction", "Interfaces"]
            },
            {
                "name": "Exception Handling",
                "description": "Robust error management using try-catch blocks and throws expressions.",
                "subtopics": ["Try-Catch Block", "Throw vs Throws", "Custom Exceptions"]
            },
            {
                "name": "Collections Framework",
                "description": "Standard structures for managing groups of object elements.",
                "subtopics": ["List Interface", "Set Interface", "Map Interface", "Queue Interface"]
            },
            {
                "name": "Advanced Java",
                "description": "Multithreading, databases, networks, generics, and files in Java.",
                "subtopics": ["Generics", "File Handling", "Multithreading", "JDBC", "Java 8+ Features"]
            }
        ]
    },
    {
        "name": "Python",
        "description": "General-purpose high-level programming language and scientific computing.",
        "topics": [
            {
                "name": "Python Basics",
                "description": "Basic Python syntax, conditions, loops, and variable types.",
                "subtopics": ["Variables and Data Types", "Operators", "Input and Output", "Conditional Statements", "Loops"]
            },
            {
                "name": "Functions & Modules",
                "description": "Declaring functions, list comprehensions, namespaces, and importing packages.",
                "subtopics": ["Functions", "List Comprehensions", "Modules and Packages", "Lambda Functions", "Decorators"]
            },
            {
                "name": "Python Data Structures",
                "description": "Lists, tuples, sets, dictionaries, and string manipulation in Python.",
                "subtopics": ["Lists", "Tuples", "Sets", "Dictionaries", "Strings"]
            },
            {
                "name": "OOP in Python",
                "description": "Classes, inheritance, magic methods, exceptions, and file handling.",
                "subtopics": ["OOP Principles", "Iterators and Generators", "Exception Handling", "File Handling"]
            },
            {
                "name": "Data Libraries",
                "description": "Introduction to scientific computing libraries NumPy and Pandas.",
                "subtopics": ["NumPy Basics", "Pandas Basics"]
            }
        ]
    },
    {
        "name": "Data Structures",
        "description": "Fundamental organization, management, and storage formats of data.",
        "topics": [
            {
                "name": "Introduction",
                "description": "Complexity analysis, dynamic sizing, and stack parameters.",
                "subtopics": ["Introduction to Data Structures", "Complexity Analysis", "Recursion"]
            },
            {
                "name": "Linear Data Structures",
                "description": "Contiguous and linked nodes: Lists, stacks, queues, and deques.",
                "subtopics": ["Arrays", "Linked Lists", "Stacks", "Queues", "Circular Queues", "Deques"]
            },
            {
                "name": "Non-Linear Data Structures",
                "description": "Hierarchical and network nodes: Trees, graphs, heaps, and hashes.",
                "subtopics": ["Hashing", "Trees", "Binary Trees", "Binary Search Trees", "Heaps", "Priority Queues", "Graphs", "Graph Traversal", "BFS", "DFS"]
            },
            {
                "name": "Algorithms",
                "description": "Searching, sorting, dynamic planning, and greedy routing algorithms.",
                "subtopics": ["Sorting", "Searching", "Recursion", "Dynamic Programming", "Greedy Algorithms"]
            }
        ]
    },
    {
        "name": "DBMS",
        "description": "Relational database management systems and SQL queries.",
        "topics": [
            {
                "name": "Fundamentals",
                "description": "Architecture, ER schemas, keys, constraints, and relationships.",
                "subtopics": ["Database Fundamentals", "DBMS Architecture", "ER Model", "Relational Model", "Keys", "Constraints"]
            },
            {
                "name": "SQL Programming",
                "description": "Syntax structures for data definition, manipulation, control, and transaction.",
                "subtopics": ["SQL Syntax", "DDL", "DML", "DCL", "TCL", "Joins", "Subqueries", "Aggregate Functions"]
            },
            {
                "name": "Database Optimization",
                "description": "Dependencies, normal forms, transaction properties, locking, and indexing.",
                "subtopics": ["Normalization", "Functional Dependencies", "Transactions", "ACID Properties", "Concurrency Control", "Indexing", "Query Optimization", "Database Security"]
            }
        ]
    },
    {
        "name": "Computer Networks",
        "description": "Data communication, network architectures, protocols, and routing.",
        "topics": [
            {
                "name": "Fundamentals",
                "description": "Topology, connections, physical nodes, OSI stack, and TCP/IP stack.",
                "subtopics": ["Networking Fundamentals", "Network Types", "Network Topologies", "OSI Model", "TCP/IP Model"]
            },
            {
                "name": "Physical & Link Layers",
                "description": "Framing, collision control, subnet calculations, IP addresses, and routing.",
                "subtopics": ["Physical Layer", "Data Link Layer", "IP Addressing", "IPv4", "IPv6", "Subnetting", "Routing"]
            },
            {
                "name": "Transport & Application Layers",
                "description": "Connections, flow buffers, congestion controllers, and high level network protocols.",
                "subtopics": ["Transport Layer", "TCP", "UDP", "Application Layer", "HTTP", "HTTPS", "DNS", "DHCP", "Network Security"]
            }
        ]
    },
    {
        "name": "Operating Systems",
        "description": "System software managing hardware resources and execution of programs.",
        "topics": [
            {
                "name": "Fundamentals",
                "description": "Hardware abstractions, OS interfaces, kernels, and system resources.",
                "subtopics": ["OS Fundamentals", "OS Architecture"]
            },
            {
                "name": "Process & Thread Management",
                "description": "Concurrency, context buffers, queues, synchronization blocks, and deadlocks.",
                "subtopics": ["Processes", "Process Scheduling", "Threads", "CPU Scheduling", "Synchronization", "Critical Section", "Semaphores", "Deadlocks"]
            },
            {
                "name": "Memory & Resource Management",
                "description": "Allocation buffers, virtual pages, fragmentation, files, and sectors.",
                "subtopics": ["Memory Management", "Paging", "Segmentation", "Virtual Memory", "File Systems", "Disk Scheduling", "I/O Management", "Security and Protection"]
            }
        ]
    },
    {
        "name": "Machine Learning",
        "description": "Algorithms that learn patterns from data and make predictions.",
        "topics": [
            {
                "name": "Fundamentals",
                "description": "Categories of algorithms, cleaning, transformations, features, and evaluation stats.",
                "subtopics": ["Introduction to Machine Learning", "Types of Machine Learning", "Data Preprocessing", "Feature Engineering"]
            },
            {
                "name": "Supervised Learning",
                "description": "Regression models, decision forests, classifier boundaries, and decision tree arrays.",
                "subtopics": ["Linear Regression", "Multiple Linear Regression", "Logistic Regression", "KNN", "Decision Trees", "Random Forest", "SVM", "Naive Bayes"]
            },
            {
                "name": "Unsupervised & Advanced",
                "description": "Groups cluster arrays, dimension reduction layers, MLP neurons, and backpropagation.",
                "subtopics": ["Clustering", "K-Means", "Dimensionality Reduction", "Model Evaluation", "Cross Validation", "Overfitting", "Underfitting", "Neural Networks", "Deep Learning Basics"]
            }
        ]
    }
]

async def seed():
    # Attempt to initialize db connection
    await connect_to_mongo()
    db = get_database()
    
    print("Dropping existing subjects and topics collections for clean seed...")
    await db.subjects.drop()
    await db.topics.drop()
    
    print("Inserting subjects and topic-subtopic curriculum hierarchy...")
    
    for subj_data in SEEDED_SUBJECTS:
        subject_dict = {
            "name": subj_data["name"],
            "description": subj_data["description"]
        }
        res = await db.subjects.insert_one(subject_dict)
        subject_id = res.inserted_id
        
        topics_list = []
        for topic in subj_data["topics"]:
            topics_list.append({
                "subject_id": subject_id,
                "name": topic["name"],
                "description": topic["description"],
                "subtopics": topic["subtopics"]
            })
        
        if topics_list:
            await db.topics.insert_many(topics_list)
            
    print(f"Successfully seeded {len(SEEDED_SUBJECTS)} subjects with complete topic-subtopic structures!")
    await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(seed())
