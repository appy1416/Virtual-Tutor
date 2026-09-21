import React from 'react';
import { User, Mail, Shield, GraduationCap, Calendar, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Profile = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-3xl mx-auto space-y-6 font-sans">
      <div className="p-6 sm:p-8 rounded-3xl border border-[#E8D8CF] bg-white shadow-sm relative overflow-hidden space-y-6">
        <div className="flex items-center gap-6">
          <div className="h-20 w-20 rounded-3xl bg-[#FF5A36] flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-[#FF5A36]/25">
            {user?.name ? user.name.charAt(0) : 'U'}
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1E1B18]">{user?.name}</h1>
            <p className="text-xs text-[#FF5A36] font-extrabold capitalize mt-0.5">{user?.role} Account</p>
            <p className="text-xs text-[#786F68] mt-1 font-medium">{user?.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#F3E8E2]">
          <div className="p-4 rounded-2xl bg-[#FFF9F6] border border-[#E8D8CF] flex items-center gap-3">
            <User className="h-5 w-5 text-[#FF5A36] shrink-0" />
            <div>
              <p className="text-[10px] text-[#786F68] font-bold uppercase">Full Name</p>
              <p className="text-xs font-extrabold text-[#1E1B18]">{user?.name}</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#FFF9F6] border border-[#E8D8CF] flex items-center gap-3">
            <Mail className="h-5 w-5 text-[#FF5A36] shrink-0" />
            <div>
              <p className="text-[10px] text-[#786F68] font-bold uppercase">Email Address</p>
              <p className="text-xs font-extrabold text-[#1E1B18]">{user?.email}</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#FFF9F6] border border-[#E8D8CF] flex items-center gap-3">
            <Shield className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-[10px] text-[#786F68] font-bold uppercase">System Role</p>
              <p className="text-xs font-extrabold text-[#1E1B18] capitalize">{user?.role}</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#FFF9F6] border border-[#E8D8CF] flex items-center gap-3">
            <GraduationCap className="h-5 w-5 text-[#FF5A36] shrink-0" />
            <div>
              <p className="text-[10px] text-[#786F68] font-bold uppercase">Platform Status</p>
              <p className="text-xs font-extrabold text-emerald-600">Active & Verified</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
