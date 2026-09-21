import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { 
  Calendar, Trash2, CheckCircle2, Circle, Plus, BookOpen, AlertCircle, Clock, Zap, Star
} from 'lucide-react';

const card = { background: '#FFFFFF', border: '1px solid #E8D8CF', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' };

const StudyPlanner = () => {
  const [subjects, setSubjects] = useState([]);
  const [availableTopics, setAvailableTopics] = useState([]);
  
  // Active plan state
  const [activePlan, setActivePlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const getDefaultExamDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  };

  // Form states
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [examDate, setExamDate] = useState(getDefaultExamDate());
  const [studyTime, setStudyTime] = useState('09:00 PM');
  const [availableHours, setAvailableHours] = useState(2.0);
  const [sessionDuration, setSessionDuration] = useState(45);
  const [priority, setPriority] = useState('medium');

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Sync available topics dynamically when selected subjects change
  useEffect(() => {
    if (selectedSubjects.length > 0) {
      const filtered = [];
      selectedSubjects.forEach(subName => {
        const subObj = subjects.find(s => s.name === subName);
        if (subObj && subObj.topics) {
          filtered.push(...subObj.topics);
        }
      });
      setAvailableTopics(filtered);
      setSelectedTopics(prev => {
        const valid = prev.filter(tName => filtered.some(ft => ft.name === tName));
        if (valid.length === 0 && filtered.length > 0) {
          return [filtered[0].name];
        }
        return valid;
      });
    } else {
      setAvailableTopics([]);
      setSelectedTopics([]);
    }
  }, [selectedSubjects, subjects]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [subRes, planRes] = await Promise.all([
        api.get('/api/subjects'),
        api.get('/api/study-plans/active')
      ]);
      const rawSubjects = subRes.data || [];
      const subjectsWithTopics = await Promise.all(
        rawSubjects.map(async (sub) => {
          if (sub.topics && sub.topics.length > 0) return sub;
          try {
            const topRes = await api.get(`/api/subjects/${sub.id}/topics`);
            return { ...sub, topics: topRes.data || [] };
          } catch {
            return { ...sub, topics: [] };
          }
        })
      );
      setSubjects(subjectsWithTopics);
      if (subjectsWithTopics.length > 0 && selectedSubjects.length === 0) {
        setSelectedSubjects([subjectsWithTopics[0].name]);
        if (subjectsWithTopics[0].topics && subjectsWithTopics[0].topics.length > 0) {
          setSelectedTopics([subjectsWithTopics[0].topics[0].name]);
        }
      }
      setActivePlan(planRes.data);
    } catch (err) {
      console.error('Failed to load study planner data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectToggle = (subName) => {
    setSelectedSubjects(prev =>
      prev.includes(subName)
        ? prev.filter(s => s !== subName)
        : [...prev, subName]
    );
  };

  const handleTopicToggle = (topicName) => {
    setSelectedTopics(prev => 
      prev.includes(topicName)
        ? prev.filter(t => t !== topicName)
        : [...prev, topicName]
    );
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!examDate) {
      alert('Please select a target exam date.');
      return;
    }
    if (selectedTopics.length === 0) {
      alert('Please select at least one topic to study.');
      return;
    }
    setGenerating(true);

    try {
      const res = await api.post('/api/study-plans/generate', {
        exam_date: examDate,
        subjects: selectedSubjects.length > 0 ? selectedSubjects : [subjects[0]?.name || 'Computer Science'],
        topics: selectedTopics,
        available_hours_per_day: availableHours,
        session_duration_minutes: sessionDuration,
        preferred_session_duration: sessionDuration,
        study_time: studyTime,
        priority
      });
      setActivePlan(res.data);
    } catch (err) {
      console.error('Study plan generation failed', err);
      alert('Failed to generate study plan. Verify the backend service.');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleComplete = async (taskId, duration) => {
    if (!activePlan) return;
    const planId = activePlan.id || activePlan._id;
    try {
      await api.post(`/api/study-plans/${planId}/tasks/${taskId}/complete`, {
        duration_minutes: duration
      });
      const planRes = await api.get('/api/study-plans/active');
      setActivePlan(planRes.data);
    } catch (err) {
      console.error('Failed to update task completion', err);
    }
  };

  const handleDeletePlan = async () => {
    if (!activePlan) return;
    const planId = activePlan.id || activePlan._id;
    try {
      await api.delete(`/api/study-plans/${planId}`);
      setActivePlan(null);
    } catch (err) {
      console.error('Failed to delete study plan', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF5A36]" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-sans pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[#FF5A36] text-white shadow-md">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1E1B18]">Personalized Study Planner</h1>
            <p className="text-xs font-medium text-[#4A443F] mt-0.5">Automated timetable generator with adaptive scheduling and Bayesian Knowledge mastery.</p>
          </div>
        </div>

        {activePlan && (
          <button
            onClick={handleDeletePlan}
            className="px-4 py-2 rounded-2xl text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 flex items-center gap-1.5 self-start sm:self-auto transition-all"
          >
            <Trash2 className="h-4 w-4" /> Reset Study Plan
          </button>
        )}
      </div>

      {!activePlan ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Form Column */}
          <div className="p-6 sm:p-8 rounded-3xl space-y-5" style={card}>
            <div>
              <h2 className="text-base font-extrabold flex items-center gap-2 text-[#1E1B18]">
                <Clock className="h-5 w-5 text-[#FF5A36]" /> Exam Checkpoint Settings
              </h2>
              <p className="text-xs mt-1 text-[#4A443F]">Configure your exam dates, availability, and session lengths.</p>
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Target Exam Date</label>
                <input
                  type="date"
                  required
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl text-xs font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Study Hrs/Day</label>
                  <input
                    type="number"
                    min="0.5"
                    max="12"
                    step="0.5"
                    required
                    value={availableHours}
                    onChange={(e) => setAvailableHours(parseFloat(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-2xl text-xs font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Session Min</label>
                  <select
                    value={sessionDuration}
                    onChange={(e) => setSessionDuration(parseInt(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-2xl text-xs font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none cursor-pointer"
                  >
                    <option value="30">30 Min</option>
                    <option value="45">45 Min</option>
                    <option value="60">60 Min</option>
                    <option value="90">90 Min</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Study Time</label>
                  <input
                    type="time"
                    value={studyTime}
                    onChange={(e) => setStudyTime(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl text-xs font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#4A443F]">Planner Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl text-xs font-semibold bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] focus:outline-none cursor-pointer"
                  >
                    <option value="low">Low - Relaxed Study</option>
                    <option value="medium">Medium - Standard Pace</option>
                    <option value="high">High - Targeted Sprint</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={generating || selectedTopics.length === 0}
                className="w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-40 text-white bg-[#FF5A36] hover:bg-[#E04826] shadow-md mt-2"
              >
                {generating ? 'Formulating Schedule...' : 'Generate Plan'}
              </button>
            </form>
          </div>

          {/* Curriculum Checklist */}
          <div className="lg:col-span-2 p-6 sm:p-8 rounded-3xl space-y-6" style={card}>
            <div>
              <h2 className="text-base font-extrabold flex items-center gap-2 text-[#1E1B18]">
                <BookOpen className="h-5 w-5 text-[#FF5A36]" /> Syllabus Selections
              </h2>
              <p className="text-xs text-[#4A443F] mt-1">Select the Subjects and Topics you want to prepare for this checkpoint.</p>
            </div>

            {/* Subjects multi-checkbox */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#4A443F]">Subjects to Include</label>
              <div className="flex flex-wrap gap-2">
                {subjects.map((sub) => {
                  const isSelected = selectedSubjects.includes(sub.name);
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => handleSubjectToggle(sub.name)}
                      className={`px-4 py-2 rounded-2xl text-xs font-bold border transition-all ${
                        isSelected 
                          ? 'bg-[#FF5A36] text-white border-[#FF5A36] shadow-sm' 
                          : 'bg-[#FFF9F6] border-[#E8D8CF] text-[#1E1B18] hover:bg-[#FFF0EB]'
                      }`}
                    >
                      {sub.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Topics checklist */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#4A443F]">Topics to Master</label>
                {availableTopics.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTopics(availableTopics.map(t => t.name))}
                      className="text-[11px] font-bold text-[#FF5A36] hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-[#E8D8CF]">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTopics([])}
                      className="text-[11px] font-bold text-[#786F68] hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
              {availableTopics.length === 0 ? (
                <p className="text-xs italic text-[#786F68]">Select at least one Subject above to see available topics.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-2">
                  {availableTopics.map((topic) => {
                    const isSelected = selectedTopics.includes(topic.name);
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => handleTopicToggle(topic.name)}
                        className={`p-3.5 rounded-2xl border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                          isSelected 
                            ? 'bg-[#FFF0EB] border-[#FF5A36] text-[#1E1B18] shadow-sm' 
                            : 'bg-[#FFF9F6] border-[#E8D8CF] text-[#1E1B18] hover:border-[#FF5A36]'
                        }`}
                      >
                        <span className="truncate">{topic.name}</span>
                        {isSelected ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#FF5A36]" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-[#786F68]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Active Study Plan Task Viewer
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Plan Info Card */}
          <div className="p-6 sm:p-8 rounded-3xl space-y-5" style={card}>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-[#FFF0EB] text-[#FF5A36] border border-[#FFE4D9]">
                Active Study Plan
              </span>
              <h2 className="text-base font-extrabold text-[#1E1B18] mt-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#FF5A36]" /> Preparation Dashboard
              </h2>
            </div>

            <div className="space-y-3.5 text-xs text-[#1E1B18]">
              <div className="flex justify-between py-2 border-b border-[#F3E8E2]">
                <span className="text-[#786F68]">Target Exam:</span>
                <span className="font-extrabold">{activePlan.exam_date}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#F3E8E2]">
                <span className="text-[#786F68]">Study Load:</span>
                <span className="font-extrabold">{activePlan.available_hours_per_day} Hrs/Day</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#F3E8E2]">
                <span className="text-[#786F68]">Total Tasks:</span>
                <span className="font-extrabold">{activePlan.tasks?.length || 0}</span>
              </div>
            </div>
          </div>

          {/* Plan Tasks List */}
          <div className="lg:col-span-2 p-6 sm:p-8 rounded-3xl space-y-4" style={card}>
            <h2 className="text-base font-extrabold text-[#1E1B18] flex items-center gap-2">
              <Zap className="h-5 w-5 text-[#FF5A36]" /> Scheduled Study Tasks
            </h2>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {activePlan.tasks && activePlan.tasks.map((task, index) => {
                const taskId = task.task_id || task.id || String(index);
                const topicName = task.topic || task.topic_name || task.description;
                const subjectName = task.subject || task.subject_name || 'Study Module';
                const dayNum = task.day_number || Math.floor(index / 2) + 1;
                return (
                  <div
                    key={taskId}
                    onClick={() => handleToggleComplete(taskId, task.duration_minutes)}
                    className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                      task.completed
                        ? 'bg-[#FFF9F6] border-[#E8D8CF] opacity-60'
                        : 'bg-white border-[#E8D8CF] hover:border-[#FF5A36] shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl shrink-0 ${task.completed ? 'bg-emerald-100 text-emerald-800' : 'bg-[#FFF0EB] text-[#FF5A36]'}`}>
                        {task.completed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                      </div>
                      <div>
                        <h3 className={`text-xs sm:text-sm font-extrabold ${task.completed ? 'line-through text-[#786F68]' : 'text-[#1E1B18]'}`}>
                          {topicName}
                        </h3>
                        <p className="text-[10px] text-[#786F68]">{subjectName} • {task.duration_minutes} Mins</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-[#FF5A36] bg-[#FFF0EB] px-2.5 py-1 rounded-full border border-[#FFE4D9]">
                      Day {dayNum}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyPlanner;
