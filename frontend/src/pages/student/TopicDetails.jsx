import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  BookOpen, Sparkles, Award, ArrowLeft, GraduationCap, Code, Lightbulb, 
  HelpCircle, MessageSquare, ChevronRight, HelpCircle as QuestionIcon
} from 'lucide-react';

const card = { background: '#FFFFFF', border: '1px solid #E8D8CF', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' };

const TopicDetails = () => {
  const { subjectId, topicId } = useParams();
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Subtopic learning state
  const [activeSubtopic, setActiveSubtopic] = useState(null);
  const [learningContent, setLearningContent] = useState(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [activeTab, setActiveTab] = useState('explanation');

  // Flashcards state
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Practice state
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null);
  const [practiceAnswered, setPracticeAnswered] = useState(false);

  useEffect(() => { 
    fetchTopicDetails(); 
  }, [topicId]);

  const fetchTopicDetails = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/subjects/topics/${topicId}`);
      setTopic(res.data);
    } catch (err) { 
      console.error('Failed to load topic details', err); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleSubtopicClick = async (subtopicName) => {
    setActiveSubtopic(subtopicName);
    setLearningContent(null);
    setLoadingContent(true);
    setActiveTab('explanation');
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setSelectedOptionIndex(null);
    setPracticeAnswered(false);

    try {
      const res = await api.get('/api/subjects/topics/subtopics/explain', {
        params: {
          subject_name: topic.subject_name,
          topic_name: topic.name,
          subtopic: subtopicName
        }
      });
      setLearningContent(res.data);
    } catch (err) {
      console.error('Failed to load subtopic details', err);
    } finally {
      setLoadingContent(false);
    }
  };

  const handleAskAI = () => {
    const query = activeSubtopic 
      ? `Explain "${activeSubtopic}" in the context of "${topic?.name}" in "${topic?.subject_name}".`
      : `Explain ${topic?.name} in the context of ${topic?.subject_name}.`;
    navigate('/ai-tutor', { state: { prefillQuery: query } });
  };

  const handleTakeQuiz = () => {
    navigate('/quiz', { 
      state: { 
        prefillSubjectId: subjectId, 
        prefillTopicId: topicId, 
        prefillTopicName: topic?.name,
        prefillSubtopic: activeSubtopic
      } 
    });
  };

  const handleNextCard = () => {
    if (!learningContent?.flashcards) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentCardIndex((prev) => (prev + 1) % learningContent.flashcards.length);
    }, 150);
  };

  const handlePrevCard = () => {
    if (!learningContent?.flashcards) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentCardIndex((prev) => (prev - 1 + learningContent.flashcards.length) % learningContent.flashcards.length);
    }, 150);
  };

  const handleOptionClick = (idx) => {
    if (practiceAnswered) return;
    setSelectedOptionIndex(idx);
    setPracticeAnswered(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: '#FF5A36' }}></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-sans pb-6">
      
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            if (activeSubtopic) {
              setActiveSubtopic(null);
              setLearningContent(null);
            } else {
              navigate('/subjects');
            }
          }}
          className="flex items-center gap-2 text-xs font-bold transition-all select-none"
          style={{ color: '#6A645D' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#FF5A36'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#6A645D'}
        >
          <ArrowLeft className="h-4 w-4" /> 
          {activeSubtopic ? `Back to ${topic?.name}` : 'Back to Subjects'}
        </button>

        {activeSubtopic && (
          <span className="text-[10px] font-black uppercase tracking-wider text-[#6A645D]">
            Current Subtopic: <span className="text-[#FF5A36]">{activeSubtopic}</span>
          </span>
        )}
      </div>

      {/* Main Container */}
      {!activeSubtopic ? (
        // Standard Topic View
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Topic Detail Card */}
          <div className="lg:col-span-2 rounded-2xl p-6 sm:p-8 space-y-6" style={card}>
            <div className="space-y-2">
              <div className="flex">
                <span className="px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-full"
                  style={{ background: 'rgba(255,90,54,0.1)', color: '#FF5A36', border: '1px solid rgba(255,90,54,0.2)' }}>
                  {topic?.subject_name}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black pt-2 text-[#1E1B18]">{topic?.name}</h1>
              <p className="text-xs sm:text-sm leading-relaxed pt-1 text-[#6A645D]">{topic?.description}</p>
            </div>

            <div className="pt-5 border-t border-[#E8D8CF]">
              <h3 className="text-sm font-bold mb-2 flex items-center gap-2 text-[#1E1B18]">
                <GraduationCap className="h-5 w-5" style={{ color: '#FF5A36' }} /> Study Pathways
              </h3>
              <p className="text-xs leading-relaxed max-w-xl text-[#6A645D]">
                Select a specific subtopic on the right to start learning in detail, or consult the general AI tutor and test your readiness below.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={handleAskAI}
                className="p-5 sm:p-6 rounded-2xl flex flex-col items-start gap-3 transition-all text-left group w-full hover:shadow-md"
                style={{ background: 'rgba(255,90,54,0.04)', border: '1px solid rgba(255,90,54,0.2)' }}
              >
                <div className="p-2.5 rounded-xl group-hover:scale-105 transition-all" style={{ background: '#FF5A36', color: '#FFFFFF' }}>
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-[#1E1B18]">Consult AI Tutor</h4>
                  <p className="text-xs mt-1 text-[#6A645D]">Get custom simple explanations, examples, and points about this topic.</p>
                </div>
              </button>

              <button
                onClick={handleTakeQuiz}
                className="p-5 sm:p-6 rounded-2xl flex flex-col items-start gap-3 transition-all text-left group w-full hover:shadow-md"
                style={{ background: 'rgba(255,90,54,0.04)', border: '1px solid rgba(255,90,54,0.2)' }}
              >
                <div className="p-2.5 rounded-xl group-hover:scale-105 transition-all" style={{ background: '#FF5A36', color: '#FFFFFF' }}>
                  <Award className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-[#1E1B18]">Launch Practice Quiz</h4>
                  <p className="text-xs mt-1 text-[#6A645D]">Generate a 5-question MCQ to test your mastery of this topic.</p>
                </div>
              </button>
            </div>
          </div>

          {/* Subtopics Selection Card */}
          <div className="p-6 rounded-2xl flex flex-col gap-4 h-fit" style={card}>
            <div>
              <h3 className="text-sm font-black flex items-center gap-2 text-[#1E1B18]">
                <BookOpen className="h-5 w-5" style={{ color: '#FF5A36' }} /> Subtopics List
              </h3>
              <p className="text-[11px] mt-0.5 text-[#6A645D]">Pick a subtopic to open its dedicated learning guides.</p>
            </div>
            
            <div className="space-y-2">
              {topic?.subtopics && topic.subtopics.length > 0 ? (
                topic.subtopics.map((sub, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSubtopicClick(sub)}
                    className="w-full p-3.5 rounded-xl text-left text-xs font-bold flex items-center justify-between border transition-all hover:border-[#FF5A36] hover:bg-[#FFF4F0] text-[#1E1B18]"
                    style={{ 
                      background: '#FFF9F6', 
                      borderColor: '#E8D8CF'
                    }}
                  >
                    <span className="truncate">{sub}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#FF5A36]" />
                  </button>
                ))
              ) : (
                <p className="text-xs text-[#6A645D] italic">No subtopics available for this topic.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Subtopic Interactive Learning Section
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Learning Content Panel */}
          <div className="lg:col-span-2 rounded-2xl p-6 sm:p-8 space-y-6 flex flex-col" style={card}>
            
            {/* Subtopic Title Header */}
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#FF5A36]">
                {topic?.name}
              </span>
              <h2 className="text-xl font-black text-[#1E1B18]">{activeSubtopic}</h2>
            </div>

            {loadingContent ? (
              <div className="flex-1 flex flex-col justify-center items-center py-24 space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#FF5A36' }}></div>
                <p className="text-xs text-[#6A645D] italic">Generating custom study materials...</p>
              </div>
            ) : !learningContent ? (
              <div className="py-20 text-center text-xs text-rose-500">
                Failed to load subtopic explanations. Please try again.
              </div>
            ) : (
              // Structured Content Display
              <div className="space-y-6 flex-1">
                {/* Navigation Tabs */}
                <div className="flex border-b border-[#E8D8CF] gap-4 overflow-x-auto">
                  {[
                    { id: 'explanation', label: 'Explanation', icon: BookOpen },
                    { id: 'examples', label: 'Examples', icon: Code },
                    { id: 'concepts', label: 'Key Concepts', icon: Lightbulb },
                    { id: 'flashcards', label: 'Flashcards', icon: Sparkles },
                    { id: 'practice', label: 'Practice Quiz', icon: HelpCircle }
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className="py-3 text-xs font-extrabold flex items-center gap-1.5 border-b-2 transition-all shrink-0"
                        style={{
                          borderColor: isActive ? '#FF5A36' : 'transparent',
                          color: isActive ? '#FF5A36' : '#6A645D'
                        }}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Tab Contents */}
                <div className="flex-1 min-h-[300px]">
                  {activeTab === 'explanation' && (
                    <div className="space-y-4">
                      <p className="text-xs sm:text-sm leading-relaxed text-[#2D2825] whitespace-pre-line">
                        {learningContent.explanation}
                      </p>
                    </div>
                  )}

                  {activeTab === 'examples' && (
                    <div className="space-y-4">
                      <pre className="p-4 rounded-xl text-xs overflow-x-auto font-mono text-emerald-800"
                        style={{ background: '#F4F9F5', border: '1px solid #D1E7DD' }}>
                        <code>{learningContent.examples}</code>
                      </pre>
                    </div>
                  )}

                  {activeTab === 'concepts' && (
                    <div className="space-y-3">
                      {learningContent.key_concepts?.map((c, i) => (
                        <div key={i} className="flex gap-3 p-3.5 rounded-xl text-xs font-bold"
                          style={{ background: '#FFF9F6', border: '1px solid #E8D8CF' }}>
                          <span className="h-5 w-5 rounded-full shrink-0 flex items-center justify-center text-white font-extrabold"
                            style={{ background: '#FF5A36' }}>
                            {i + 1}
                          </span>
                          <span className="text-[#2D2825] self-center leading-relaxed">{c}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'flashcards' && (
                    <div className="flex flex-col items-center justify-center py-6 gap-6">
                      {learningContent.flashcards && learningContent.flashcards.length > 0 ? (
                        <>
                          <div 
                            onClick={() => setIsFlipped(!isFlipped)}
                            className="w-full max-w-sm h-48 rounded-2xl border flex flex-col justify-center items-center p-6 text-center cursor-pointer transition-all duration-300 select-none shadow-sm"
                            style={{
                              background: isFlipped ? '#FFF4F0' : '#FFFFFF',
                              borderColor: isFlipped ? '#FF5A36' : '#E8D8CF',
                            }}
                          >
                            <span className="text-[10px] font-black uppercase tracking-wider text-[#FF5A36] mb-4">
                              {isFlipped ? 'Answer (Click to flip)' : 'Question (Click to flip)'}
                            </span>
                            <h3 className="text-xs sm:text-sm font-extrabold leading-relaxed text-[#1E1B18]">
                              {isFlipped 
                                ? learningContent.flashcards[currentCardIndex].back 
                                : learningContent.flashcards[currentCardIndex].front
                              }
                            </h3>
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs font-bold">
                            <button onClick={handlePrevCard} className="px-3 py-1.5 rounded-lg bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] hover:border-[#FF5A36]">
                              Prev
                            </button>
                            <span className="text-[#6A645D]">
                              {currentCardIndex + 1} of {learningContent.flashcards.length}
                            </span>
                            <button onClick={handleNextCard} className="px-3 py-1.5 rounded-lg bg-[#FFF9F6] border border-[#E8D8CF] text-[#1E1B18] hover:border-[#FF5A36]">
                              Next
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-[#6A645D] italic">No flashcards generated.</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'practice' && (
                    <div className="space-y-5">
                      {learningContent.practice?.map((item, qIdx) => (
                        <div key={qIdx} className="space-y-4">
                          <h4 className="text-xs sm:text-sm font-extrabold text-[#1E1B18] leading-relaxed">
                            {item.question}
                          </h4>
                          
                          <div className="grid grid-cols-1 gap-2.5">
                            {item.options.map((opt, oIdx) => {
                              const isSelected = selectedOptionIndex === oIdx;
                              const isCorrect = oIdx === item.correct_index;
                              
                              let btnStyle = {
                                background: '#FFF9F6',
                                border: '1px solid #E8D8CF',
                                color: '#1E1B18'
                              };

                              if (practiceAnswered) {
                                if (isCorrect) {
                                  btnStyle = {
                                    background: 'rgba(16,185,129,0.1)',
                                    border: '1px solid rgba(16,185,129,0.4)',
                                    color: '#065f46'
                                  };
                                } else if (isSelected) {
                                  btnStyle = {
                                    background: 'rgba(239,68,68,0.1)',
                                    border: '1px solid rgba(239,68,68,0.4)',
                                    color: '#991b1b'
                                  };
                                }
                              } else if (isSelected) {
                                btnStyle = {
                                  background: 'rgba(255,90,54,0.1)',
                                  border: '1px solid #FF5A36',
                                  color: '#FF5A36'
                                };
                              }

                              return (
                                <button
                                  key={oIdx}
                                  onClick={() => handleOptionClick(oIdx)}
                                  className="p-3 rounded-xl text-left text-xs font-semibold w-full transition-all flex items-center justify-between"
                                  style={btnStyle}
                                >
                                  <span>{opt}</span>
                                  {practiceAnswered && isCorrect && (
                                    <span className="text-[10px] font-black uppercase text-emerald-600 font-bold">Correct</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {practiceAnswered && (
                            <p className="text-[11px] text-[#6A645D] italic leading-relaxed pt-2">
                              💡 Tip: If you need a complete explanation of this question, use the **Ask AI Tutor** shortcut on the right!
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Help Shortcuts Panel */}
          <div className="p-6 rounded-2xl flex flex-col gap-5 h-fit" style={card}>
            <div>
              <h3 className="text-sm font-black flex items-center gap-2 text-[#1E1B18]">
                <Sparkles className="h-5 w-5" style={{ color: '#FF5A36' }} /> Subtopic Study Pathway
              </h3>
              <p className="text-[11px] text-[#6A645D] mt-0.5">Deep-dive or practice with our customized learning shortcuts.</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleAskAI}
                className="p-4 rounded-xl flex items-center gap-3 w-full border text-left transition-all hover:bg-[#FFF4F0] hover:border-[#FF5A36]"
                style={{ background: '#FFF9F6', borderColor: '#E8D8CF', color: '#1E1B18' }}
              >
                <div className="p-2 rounded-lg bg-[#FF5A36] text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-black text-[#1E1B18]">Ask AI Tutor</p>
                  <p className="text-[10px] text-[#6A645D] mt-0.5">Consult the assistant about this subtopic.</p>
                </div>
              </button>

              <button
                onClick={handleTakeQuiz}
                className="p-4 rounded-xl flex items-center gap-3 w-full border text-left transition-all hover:bg-[#FFF4F0] hover:border-[#FF5A36]"
                style={{ background: '#FFF9F6', borderColor: '#E8D8CF', color: '#1E1B18' }}
              >
                <div className="p-2 rounded-lg bg-[#FF5A36] text-white">
                  <Award className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-black text-[#1E1B18]">Take Full Quiz</p>
                  <p className="text-[10px] text-[#6A645D] mt-0.5">Launch a dynamic 5-question test Arena.</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/doubt-solver')}
                className="p-4 rounded-xl flex items-center gap-3 w-full border text-left transition-all hover:bg-[#FFF4F0] hover:border-[#FF5A36]"
                style={{ background: '#FFF9F6', borderColor: '#E8D8CF', color: '#1E1B18' }}
              >
                <div className="p-2 rounded-lg bg-[#F3ECE6] text-[#6A645D]">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-black text-[#1E1B18]">Open Doubt Solver</p>
                  <p className="text-[10px] text-[#6A645D] mt-0.5">Ask questions about reference materials.</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopicDetails;

