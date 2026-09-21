# Deep Learning & Analytics Plan - Virtual AI Tutor

This document details the machine learning models, algorithms, and analytical formulas implemented in the Virtual AI Tutor.

---

## 1. Deep Learning & AI Pipelines

### A. RAG & Vector Embeddings
- **Model**: `all-MiniLM-L6-v2` (via `sentence-transformers` library) for local embedding generation. It maps text chunks into a 384-dimensional dense vector space. Alternatively, can route to Gemini/OpenAI embedding APIs if configured.
- **Distance Metric**: Cosine Similarity.
- **Workflow**:
  1. Documents are tokenized/chunked into 500-character segments.
  2. Embeddings are generated and indexed in `ChromaDB`.
  3. Queries are embedded and compared with the index to fetch top $k$ (e.g. $k=3$) relevant text nodes.

### B. OCR & Math Solver
- **Model**: `EasyOCR` (built on PyTorch, using ResNet for feature extraction and LSTM/CTC for sequence recognition).
- **Fallback**: Multimodal LLM Vision API (Gemini/OpenAI) for complex math diagrams, tables, and low-contrast handwriting.
- **Math Solver Logic**:
  - The text extracted via OCR is fed into the LLM with a specialized instruction: *"Act as an expert math tutor. Solve the following problem step-by-step. Render formulas in LaTeX format, enclosed in `$$` or `$` symbols."*

### C. Voice STT & TTS
- **Speech-to-Text (STT)**: Transcribes WAV/MP3 files using Python `speech_recognition` (local pocketsphinx or web APIs) or the Whisper API wrapper.
- **Text-to-Speech (TTS)**: Synthesizes text responses into natural-sounding speech using `gTTS` (Google Text-to-Speech engine).

---

## 2. Bayesian Knowledge Tracing (BKT)

Bayesian Knowledge Tracing is used to track student mastery of specific topics over time. It models a student's learning state as a latent binary variable (learned or unlearned).

### BKT Parameters
We use standard calibrated parameters for the BKT model:
- $P(L_0)$ (Prior): Probability that a student knows the topic before starting ($0.25$).
- $P(T)$ (Transition): Probability of learning the concept after a practice opportunity ($0.15$).
- $P(G)$ (Guess): Probability of guessing correctly without mastering the topic ($0.20$).
- $P(S)$ (Slip): Probability of making a mistake despite mastering the topic ($0.10$).

### BKT Update Equations

When a student submits an answer for a quiz question associated with a topic:

1. **Calculate the posterior probability of mastery** based on the student's response:
   - **Case 1: Answer is Correct**
     $$P(L_{t} | \text{Correct}) = \frac{P(L_t)(1 - P(S))}{P(L_t)(1 - P(S)) + (1 - P(L_t))P(G)}$$
   - **Case 2: Answer is Incorrect**
     $$P(L_{t} | \text{Incorrect}) = \frac{P(L_t)P(S)}{P(L_t)P(S) + (1 - P(L_t))(1 - P(G))}$$

2. **Incorporate transition probability** (learning step):
   $$P(L_{t+1}) = P(L_{t} | \text{Response}) + (1 - P(L_{t} | \text{Response})) \cdot P(T)$$

Where $P(L_{t+1})$ is the updated mastery probability. The student is considered to have **mastered** the topic if $P(L_{t+1}) \geq 0.85$.

---

## 3. Recommendation Engine

The system uses a rule-based content recommendation engine combined with topic mastery weights to generate personalized recommendations:

```
                  [User Progress & Mastery Metrics]
                                 │
                                 ▼
                     [Identify Weak Concepts]
                   (Mastery Probability < 0.70)
                                 │
                                 ▼
                   [Consult Prerequisite Tree]
                 (Recommend unmastered dependencies)
                                 │
                   ┌─────────────┴─────────────┐
                   ▼                           ▼
       [Generate Daily Study Tasks]     [Select Practice Quizzes]
       - Review specific materials      - Target weak topics at
       - Study next-in-line lessons       adjusted difficulty levels
```

- **Next Best Action**:
  - If a student has an uncompleted study plan task, recommend completing it.
  - If a topic has mastery $P(L) < 0.70$, recommend reading the associated textbook material and taking an **Easy** practice quiz.
  - If a topic has mastery $0.70 \le P(L) < 0.85$, recommend taking a **Medium/Hard** practice quiz.
  - If all active topics are mastered ($P(L) \ge 0.85$), recommend unlocking the next course topic.

---

## 4. Analytical Metrics

### A. Subject-wise Accuracy
$$\text{Accuracy} = \frac{\sum \text{Correct Answers}}{\sum \text{Total Attempted Questions}} \times 100$$

### B. Learning Streaks
- Calculated from `analytics_events` and completed `study_plans`.
- A streak increases by 1 for each consecutive calendar day the user logs a `study_session` of at least 5 minutes or completes a `study_plan` task.
- If a day is missed, the streak resets to 0.

### C. Improvement Trends
- A moving average of quiz accuracy over the last 5 attempts.
- Slope of the linear regression of the last 5 quiz scores represents the improvement vector (positive value indicates progress).

### D. Predicted Exam Readiness
A weighted combination of:
1. **Average Concept Mastery** ($W_1 = 0.50$): Mean of $P(L)$ across all course topics.
2. **Overall Quiz Accuracy** ($W_2 = 0.30$): Cumulative accuracy rate.
3. **Study Plan Completion Rate** ($W_3 = 0.20$): Proportion of assigned tasks completed.

$$\text{Readiness Score} = (0.50 \times \overline{P(L)} + 0.30 \times \text{Accuracy} + 0.20 \times \text{Completion Rate}) \times 100$$
- Score $\ge 80\%$: Ready for Exam.
- Score $60\% - 79\%$: Moderate Preparation.
- Score $< 60\%$: Needs Revision.
