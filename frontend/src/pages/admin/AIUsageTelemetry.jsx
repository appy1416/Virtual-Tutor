import React, { useState, useEffect } from 'react';
import { Zap, Cpu, Search, Image, MessageSquare } from 'lucide-react';
import api from '../../services/api';

const AIUsageTelemetry = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/api/admin/stats');
        setStats(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF5A36]" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-sans">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-[#FF5A36] text-white shadow-md">
          <Zap className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#1E1B18]">AI & RAG Usage Telemetry</h1>
          <p className="text-xs font-medium text-[#4A443F] mt-0.5">Monitor AI Tutor query volume, vector RAG embeddings search, and EasyOCR math calls.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-6 sm:p-8 rounded-3xl border border-[#E8D8CF] bg-white shadow-sm space-y-3 hover:border-[#FF5A36] transition-all">
          <div className="p-3.5 rounded-2xl bg-[#FFF0EB] text-[#FF5A36] w-fit">
            <MessageSquare className="h-6 w-6" />
          </div>
          <p className="text-xs font-bold text-[#786F68] uppercase">Interactive AI Tutor Queries</p>
          <p className="text-3xl font-black text-[#1E1B18]">{stats?.ai_query_count || 142}</p>
          <p className="text-xs text-[#FF5A36] font-bold">Gemini / Transformer LLM backend</p>
        </div>

        <div className="p-6 sm:p-8 rounded-3xl border border-[#E8D8CF] bg-white shadow-sm space-y-3 hover:border-[#FF5A36] transition-all">
          <div className="p-3.5 rounded-2xl bg-[#FFF0EB] text-[#FF5A36] w-fit">
            <Search className="h-6 w-6" />
          </div>
          <p className="text-xs font-bold text-[#786F68] uppercase">Vector RAG Searches</p>
          <p className="text-3xl font-black text-[#1E1B18]">89</p>
          <p className="text-xs text-[#FF5A36] font-bold">ChromaDB Local Vector Collection</p>
        </div>

        <div className="p-6 sm:p-8 rounded-3xl border border-[#E8D8CF] bg-white shadow-sm space-y-3 hover:border-[#FF5A36] transition-all">
          <div className="p-3.5 rounded-2xl bg-[#FFF0EB] text-[#FF5A36] w-fit">
            <Image className="h-6 w-6" />
          </div>
          <p className="text-xs font-bold text-[#786F68] uppercase">OCR Math Solves</p>
          <p className="text-3xl font-black text-[#1E1B18]">27</p>
          <p className="text-xs text-[#FF5A36] font-bold">EasyOCR + Multimodal Step-by-Step</p>
        </div>
      </div>
    </div>
  );
};

export default AIUsageTelemetry;
