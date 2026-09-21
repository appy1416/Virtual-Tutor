import React, { useState, useEffect } from 'react';
import { Layers, Users, BookOpen, Clock } from 'lucide-react';
import api from '../../services/api';

const FacultyClasses = () => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await api.get('/api/classes');
        setClasses(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchClasses();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF5A36]" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-sans">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-[#FF5A36] text-white shadow-md">
          <Layers className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#1E1B18]">My Assigned Classes</h1>
          <p className="text-xs font-medium text-[#4A443F] mt-0.5">View teaching sections, class codes, and enrolled student count.</p>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="p-12 rounded-3xl border border-[#E8D8CF] bg-white text-center space-y-3 shadow-sm">
          <Layers className="h-10 w-10 text-[#FF5A36] mx-auto opacity-40" />
          <h3 className="text-sm font-bold text-[#1E1B18]">No Classes Assigned</h3>
          <p className="text-xs text-[#4A443F]">Contact administrator to be assigned to teaching sections.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {classes.map((cls) => (
            <div key={cls.id} className="p-6 rounded-3xl border border-[#E8D8CF] bg-white space-y-4 shadow-sm hover:border-[#FF5A36] transition-all">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-xs font-black text-[#FF5A36] bg-[#FFF0EB] border border-[#FFE4D9]">
                  {cls.code}
                </span>
                <span className="text-xs text-[#4A443F] font-bold flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-[#FF5A36]" /> {cls.student_count || 0} Enrolled
                </span>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-[#1E1B18]">{cls.name}</h3>
                <p className="text-xs sm:text-sm text-[#4A443F] font-medium mt-1 leading-relaxed">{cls.description || 'Standard academic section'}</p>
              </div>

              <div className="pt-3 border-t border-[#F3E8E2] flex items-center justify-between text-xs text-[#4A443F]">
                <span>Faculty: <strong className="text-[#1E1B18]">{cls.faculty_name || 'Assigned Teacher'}</strong></span>
                <span className="text-[10px] text-[#786F68] font-mono">Section ID: {cls.id.slice(-6)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FacultyClasses;
