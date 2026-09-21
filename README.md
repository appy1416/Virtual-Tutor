# Virtual AI Tutor: Intelligent Personalized Learning Platform

The **Virtual AI Tutor** is an advanced, end-to-end, multi-role (Student, Faculty, Admin) learning platform that adapts to individual study speeds, resolves concept doubts, generates quizzes, evaluates answers, tracks subject performance, detects weak topics, and serves next-topic recommendations.

---

## Technical Stack
- **Backend**: FastAPI (Python 3.13) + REST APIs.
- **Database**: MongoDB (via Motor async driver).
- **Vector Database**: ChromaDB (for in-process RAG).
- **AI Core**: 
  - **Gemini API** / **OpenAI API** for explanation, math solving, and quiz generation.
  - **Sentence Transformers** (`all-MiniLM-L6-v2`) for local embedding storage.
  - **EasyOCR** for offline handwritten/math problem extraction.
  - **gTTS** for speech responses.
- **Frontend**: React (Vite) + Tailwind CSS + Chart.js / ECharts.

---

## Repository Structure
```
AI VIRTUAL TUTOR/
├── backend/                  # FastAPI Application Source Code
├── frontend/                 # React Web Application Source Code
├── docs/                     # Architectural, Schema & Machine Learning Details
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   └── DL_ANALYTICS.md
├── docker-compose.yml        # Local MongoDB setup
├── .env.example              # Configuration environment template
└── README.md                 # Setup & Run Guide (This File)
```

---

## Getting Started

### Prerequisites
Make sure you have the following installed on your machine:
- **Python (3.8 - 3.13)**
- **Node.js (v18+) & npm**
- **Docker Desktop** (used to run MongoDB locally)

---

### Step 1: Clone & Configure Variables
1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your details:
   - **`GEMINI_API_KEY`**: Obtain an API key from Google AI Studio.
   - Update any port settings or databases if necessary.

---

### Step 2: Spin up Database (Docker)
Run the following command to start MongoDB and Mongo Express:
```bash
docker compose up -d
```
- MongoDB will run at: `mongodb://localhost:27017`
- Mongo Express GUI will be accessible at: `http://localhost:8081` (Username: `admin`, Password: `adminpassword`)

---

### Step 3: Set up & Run Python Backend
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI development server:
   ```bash
   python run.py
   ```
   The backend API will run at `http://localhost:8000`. You can inspect the Swagger docs at `http://localhost:8000/docs`.

---

### Step 4: Set up & Run React Frontend
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open the browser at `http://localhost:5173` to interact with the platform.
