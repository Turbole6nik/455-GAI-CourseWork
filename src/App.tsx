import React, { useState, useCallback } from 'react';
import { Upload, FileText, Download, Loader2, AlertCircle, CheckCircle2, Trash2, Table as TableIcon, TrendingUp, TrendingDown, Wallet, Hash, PieChart as PieChartIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Papa from 'papaparse';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { extractTransactions, Transaction } from './services/gemini';

export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []) as File[];
    if (selectedFiles.length > 0) {
      const validFiles = selectedFiles.filter(f => f.type === 'application/pdf' || f.type.startsWith('image/'));
      if (validFiles.length === selectedFiles.length) {
        setFiles(validFiles);
        setError(null);
      } else {
        setError('Some files are not supported. Please upload only PDFs or images.');
      }
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const processFiles = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setProcessingProgress({ current: 0, total: files.length });
    
    let allTransactions: Transaction[] = [];
    
    try {
      for (let i = 0; i < files.length; i++) {
        setProcessingProgress(prev => ({ ...prev, current: i + 1 }));
        const file = files[i];
        const base64 = await fileToBase64(file);
        const results = await extractTransactions(base64, file.type);
        allTransactions = [...allTransactions, ...results];
      }
      
      // Sort transactions by date
      allTransactions.sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        return timeB - timeA;
      });
      setTransactions(allTransactions);
    } catch (err) {
      console.error(err);
      setError('Failed to process one or more statements. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadCSV = () => {
    if (transactions.length === 0) return;
    
    const csv = Papa.unparse(transactions);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `bank_statement_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearAll = () => {
    setFiles([]);
    setTransactions([]);
    setError(null);
    setCurrentPage(1);
  };

  const stats = {
    income: transactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0),
    spending: transactions.filter(t => t.amount < 0).reduce((acc, t) => acc + t.amount, 0),
    count: transactions.length,
    net: transactions.reduce((acc, t) => acc + t.amount, 0)
  };

  const chartData = Object.entries(
    transactions
      .filter(t => t.amount < 0)
      .reduce((acc, t) => {
        const cat = t.category || 'Other';
        acc[cat] = (acc[cat] || 0) + Math.abs(t.amount);
        return acc;
      }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value: Number(value) }))
   .sort((a, b) => b.value - a.value);

  const COLORS = ['#141414', '#4B5563', '#9CA3AF', '#D1D5DB', '#E5E7EB', '#F3F4F6'];

  const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = transactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#F5F5F4]">
      {/* Header */}
      <header className="border-b border-[#141414]/10 bg-white/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#141414] rounded-xl flex items-center justify-center text-[#F5F5F4]">
              <FileText size={20} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Statement OCR</h1>
              <p className="text-xs text-[#141414]/50 font-medium uppercase tracking-wider">Powered by Gemini 2.0</p>
            </div>
          </div>
          {transactions.length > 0 && (
            <button
              onClick={downloadCSV}
              className="flex items-center gap-2 bg-[#141414] text-[#F5F5F4] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#141414]/90 transition-all active:scale-95 shadow-sm"
            >
              <Download size={16} />
              Export CSV
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Upload & Status */}
          <div className="lg:col-span-4 space-y-8">
            <section>
              <h2 className="text-sm font-semibold text-[#141414]/40 uppercase tracking-widest mb-4">Input</h2>
              <div 
                className={`relative border-2 border-dashed rounded-2xl p-8 transition-all duration-300 flex flex-col items-center justify-center text-center gap-4 bg-white shadow-sm
                  ${files.length > 0 ? 'border-[#141414]/20' : 'border-[#141414]/10 hover:border-[#141414]/30 hover:bg-white/80'}`}
              >
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,image/*"
                  multiple
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={isProcessing}
                />
                
                <div className="w-16 h-16 bg-[#F5F5F4] rounded-full flex items-center justify-center text-[#141414]/40">
                  <Upload size={28} />
                </div>
                
                <div>
                  <p className="font-medium text-sm">
                    {files.length > 0 
                      ? `${files.length} file${files.length > 1 ? 's' : ''} selected` 
                      : 'Drop statements here'}
                  </p>
                  <p className="text-xs text-[#141414]/40 mt-1">
                    PDFs or Images (Multiple allowed)
                  </p>
                </div>

                {files.length > 0 && !isProcessing && transactions.length === 0 && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={processFiles}
                    className="mt-4 w-full bg-[#141414] text-[#F5F5F4] py-3 rounded-xl text-sm font-semibold hover:bg-[#141414]/90 transition-all active:scale-95 shadow-lg"
                  >
                    Extract All Transactions
                  </motion.button>
                )}
              </div>
            </section>

            <AnimatePresence>
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white rounded-2xl p-6 border border-[#141414]/5 shadow-sm space-y-6"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Loader2 className="animate-spin text-[#141414]" size={20} />
                        <span className="text-sm font-semibold">Processing Documents</span>
                      </div>
                      <span className="text-[10px] font-bold text-[#141414]/40 bg-[#F5F5F4] px-2 py-1 rounded">
                        {Math.round((processingProgress.current / processingProgress.total) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-[#F5F5F4] h-1.5 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-[#141414]"
                        initial={{ width: "0%" }}
                        animate={{ width: `${(processingProgress.current / processingProgress.total) * 100}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-[#F5F5F4]/50 p-3 rounded-xl text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#141414]/30 mb-1">Total</p>
                      <p className="text-lg font-bold text-[#141414]">{processingProgress.total}</p>
                    </div>
                    <div className="bg-emerald-50 p-3 rounded-xl text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/50 mb-1">Done</p>
                      <p className="text-lg font-bold text-emerald-600">{processingProgress.current - 1}</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-xl text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600/50 mb-1">Pending</p>
                      <p className="text-lg font-bold text-blue-600">{processingProgress.total - processingProgress.current}</p>
                    </div>
                  </div>

                  <p className="text-xs text-[#141414]/50 leading-relaxed text-center italic">
                    Analyzing file {processingProgress.current} of {processingProgress.total}...
                  </p>
                </motion.div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-red-50 text-red-600 rounded-2xl p-4 border border-red-100 flex items-start gap-3"
                >
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{error}</p>
                </motion.div>
              )}

              {transactions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-emerald-50 text-emerald-700 rounded-2xl p-4 border border-emerald-100 flex items-start gap-3"
                >
                  <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">Extraction Complete</p>
                    <p className="text-xs opacity-80 mt-0.5">{transactions.length} transactions recovered.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {transactions.length > 0 && (
              <button
                onClick={clearAll}
                className="w-full flex items-center justify-center gap-2 text-[#141414]/40 hover:text-red-500 transition-colors text-sm font-medium py-2"
              >
                <Trash2 size={14} />
                Clear and Start Over
              </button>
            )}
          </div>

          {/* Right Column: Results Table */}
          <div className="lg:col-span-8 space-y-8">
            {/* Summary Section */}
            <AnimatePresence>
              {transactions.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                >
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#141414]/5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                        <TrendingUp size={18} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#141414]/40">Total Income</span>
                    </div>
                    <p className="text-xl font-bold text-emerald-600">
                      +${stats.income.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#141414]/5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-red-50 text-red-600 rounded-xl">
                        <TrendingDown size={18} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#141414]/40">Total Spending</span>
                    </div>
                    <p className="text-xl font-bold text-red-600">
                      ${stats.spending.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#141414]/5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                        <Wallet size={18} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#141414]/40">Net Balance</span>
                    </div>
                    <p className={`text-xl font-bold ${stats.net >= 0 ? 'text-[#141414]' : 'text-red-500'}`}>
                      {stats.net >= 0 ? '+' : ''}${stats.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#141414]/5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-[#F5F5F4] text-[#141414]/60 rounded-xl">
                        <Hash size={18} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#141414]/40">Records</span>
                    </div>
                    <p className="text-xl font-bold text-[#141414]">
                      {stats.count}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Charts Section */}
            <AnimatePresence>
              {transactions.length > 0 && chartData.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-8 rounded-3xl shadow-sm border border-[#141414]/5"
                >
                  <div className="flex items-center gap-3 mb-8">
                    <PieChartIcon size={18} className="text-[#141414]/40" />
                    <h2 className="font-semibold tracking-tight">Spending by Category</h2>
                  </div>
                  
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            borderRadius: '12px', 
                            border: '1px solid rgba(20,20,20,0.05)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                          formatter={(value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        />
                        <Legend 
                          verticalAlign="middle" 
                          align="right" 
                          layout="vertical"
                          iconType="circle"
                          wrapperStyle={{
                            fontSize: '11px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            paddingLeft: '20px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="bg-white rounded-3xl shadow-sm border border-[#141414]/5 overflow-hidden min-h-[500px] flex flex-col">
              <div className="px-8 py-6 border-b border-[#141414]/5 flex justify-between items-center bg-white/50">
                <div className="flex items-center gap-3">
                  <TableIcon size={18} className="text-[#141414]/40" />
                  <h2 className="font-semibold tracking-tight">Extracted Data</h2>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#141414]/30 bg-[#F5F5F4] px-2 py-1 rounded">
                  CSV Preview
                </span>
              </div>

              <div className="flex-1 overflow-x-auto">
                {transactions.length > 0 ? (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F5F5F4]/50">
                        <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#141414]/40 border-b border-[#141414]/5">Date</th>
                        <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#141414]/40 border-b border-[#141414]/5">Description</th>
                        <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#141414]/40 border-b border-[#141414]/5">Category</th>
                        <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#141414]/40 border-b border-[#141414]/5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#141414]/5">
                      {paginatedTransactions.map((tx, idx) => (
                        <motion.tr 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          key={idx} 
                          className="hover:bg-[#F5F5F4]/30 transition-colors group"
                        >
                          <td className="px-6 py-4 text-sm font-mono text-[#141414]/60">{tx.date}</td>
                          <td className="px-6 py-4 text-sm font-medium text-[#141414] max-w-xs truncate" title={tx.description}>
                            {tx.description}
                            {tx.notes && <p className="text-[10px] text-[#141414]/40 font-normal mt-0.5 italic">{tx.notes}</p>}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-[#F5F5F4] text-[10px] font-bold uppercase tracking-tight text-[#141414]/60">
                              {tx.category}
                            </span>
                          </td>
                          <td className={`px-6 py-4 text-sm font-bold text-right ${tx.amount < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                            {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-12 text-[#141414]/30">
                    <div className="w-16 h-16 bg-[#F5F5F4] rounded-full flex items-center justify-center mb-4">
                      <TableIcon size={32} />
                    </div>
                    <p className="text-sm font-medium">No transactions extracted yet.</p>
                    <p className="text-xs mt-1">Upload a statement to see the results here.</p>
                  </div>
                )}
              </div>

              {transactions.length > ITEMS_PER_PAGE && (
                <div className="px-8 py-4 border-t border-[#141414]/5 flex items-center justify-between bg-white/50">
                  <div className="text-xs font-medium text-[#141414]/40">
                    Showing <span className="text-[#141414] font-bold">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-[#141414] font-bold">{Math.min(currentPage * ITEMS_PER_PAGE, transactions.length)}</span> of <span className="text-[#141414] font-bold">{transactions.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg hover:bg-[#F5F5F4] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                        .map((p, i, arr) => (
                          <React.Fragment key={p}>
                            {i > 0 && arr[i - 1] !== p - 1 && (
                              <span className="text-[#141414]/20 text-xs">...</span>
                            )}
                            <button
                              onClick={() => setCurrentPage(p)}
                              className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                                currentPage === p 
                                  ? 'bg-[#141414] text-[#F5F5F4]' 
                                  : 'hover:bg-[#F5F5F4] text-[#141414]/40 hover:text-[#141414]'
                              }`}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        ))}
                    </div>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg hover:bg-[#F5F5F4] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-12 border-t border-[#141414]/5">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 opacity-40">
          <p className="text-xs font-medium">© 2026 Bank Statement OCR Tool</p>
          <div className="flex gap-8 text-[10px] font-bold uppercase tracking-widest">
            <span>Privacy Secure</span>
            <span>AI Powered</span>
            <span>CSV Export</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
