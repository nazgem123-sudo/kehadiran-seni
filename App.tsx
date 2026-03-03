
import React, { useState, useEffect, useCallback } from 'react';
import { View, Student, AttendanceRecord } from './types';
import { INITIAL_STUDENTS } from './constants';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import StudentList from './components/StudentList';
import AddStudent from './components/AddStudent';
import ImportStudent from './components/ImportStudent';
import Summary from './components/Summary';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ArchiveSearch from './components/ArchiveSearch';

export const getLocalISOString = (date: Date = new Date()) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`; 
};

// URL Deployment yang dikemaskini mengikut arahan pengguna
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwLx7hUc-EJ6qql5YL_Q_-jnUk5N7f0orsT12yJDIw2357AsCyxWKfZipyN0m4UdriUmw/exec';
const SPREADSHEET_ID = '1Otr6yM4-Zx2ifK_s7Wd2ofu8pE05hN561zpqDM-RFCA';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<View>('DASHBOARD');
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string>('Data Berjaya Disimpan');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(window.innerWidth >= 1024);
  
  const DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbwLx7hUc-EJ6qql5YL_Q_-jnUk5N7f0orsT12yJDIw2357AsCyxWKfZipyN0m4UdriUmw/exec';
  const DEFAULT_SID = '1Otr6yM4-Zx2ifK_s7Wd2ofu8pE05hN561zpqDM-RFCA';

  const [googleScriptUrl, setGoogleScriptUrl] = useState<string>(() => {
    return localStorage.getItem('art_script_url') || DEFAULT_URL;
  });
  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => {
    return localStorage.getItem('art_spreadsheet_id') || DEFAULT_SID;
  });

  const resetSettings = () => {
    if (confirm('Reset tetapan sambungan ke nilai lalai?')) {
      setGoogleScriptUrl(DEFAULT_URL);
      setSpreadsheetId(DEFAULT_SID);
      notifySuccess('Tetapan telah set semula.');
    }
  };

  useEffect(() => {
    localStorage.setItem('art_script_url', googleScriptUrl);
  }, [googleScriptUrl]);

  useEffect(() => {
    localStorage.setItem('art_spreadsheet_id', spreadsheetId);
  }, [spreadsheetId]);
  
  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem('art_students');
    return saved ? JSON.parse(saved) : INITIAL_STUDENTS;
  });
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem('art_attendance');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[][]>([]);

  useEffect(() => {
    localStorage.setItem('art_students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('art_attendance', JSON.stringify(attendance));
  }, [attendance]);

  const handleLogin = (user: string, pass: string) => {
    if (user === 'admin' && pass === 'spark') {
      setIsAuthenticated(true);
    } else {
      alert('Nama pengguna atau kata laluan salah!');
    }
  };

  const notifySuccess = (msg?: string) => {
    setToastMsg(msg || 'Data Berjaya Disimpan');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const syncToGoogleSheets = async (coachName: string, date: string, timeSlot: string, roomName: string) => {
    setIsSyncing(true);
    try {
      const filteredAttendance = attendance.filter(a => a.date === date && a.timeSlot === timeSlot);
      if (filteredAttendance.length === 0) {
        alert('Tiada data kehadiran untuk disimpan bagi sesi ini.');
        setIsSyncing(false);
        return;
      }
      
      const response = await fetch(googleScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'sync_attendance',
          spreadsheetId: spreadsheetId,
          targetDate: date,
          coachName: coachName,
          roomName: roomName,
          timeSlot: timeSlot,
          students: students,
          attendance: filteredAttendance
        }),
        redirect: 'follow'
      });
      
      const resText = await response.text();
      if (resText.toUpperCase().includes("OK")) {
        notifySuccess('Berjaya Simpan ke Google Sheets!');
      } else {
        notifySuccess('Data dihantar ke Cloud.');
      }
    } catch (error: any) {
      console.error('Error syncing:', error);
      if (error.message === 'Failed to fetch') {
        alert('RALAT SAMBUNGAN: Gagal menghubungi Google Sheets. Sila pastikan:\n1. Internet anda stabil.\n2. Google Script telah dideploy sebagai Web App (Anyone).\n3. URL Google Script adalah betul.');
      } else {
        alert('Gagal menyambung ke Google Sheets: ' + error.message);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchAttendanceByDate = async (date: string) => {
    if (!date) return;
    try {
      const response = await fetch(googleScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ 
          action: 'search_attendance', 
          spreadsheetId: spreadsheetId,
          targetDate: date 
        }),
        redirect: 'follow'
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        const newRecords: AttendanceRecord[] = [];
        data.forEach((item: any) => {
          const student = students.find(s => s.name.trim().toUpperCase() === item.name.trim().toUpperCase());
          if (student) {
            newRecords.push({
              studentId: student.id,
              date: item.date || date,
              status: (item.status === 'HADIR' || item.status === 'PRESENT' || item.status === 'Hadir') ? 'PRESENT' : 'ABSENT',
              timeSlot: item.timeSlot || 'N/A'
            });
          }
        });
        if (newRecords.length > 0) {
          setAttendance(prev => {
            const otherDates = prev.filter(a => a.date !== date);
            return [...otherDates, ...newRecords];
          });
          notifySuccess(`Data tarikh ${date.split('-').reverse().join('-')} dikemaskini.`);
        }
      }
    } catch (error: any) {
      console.error('Refresh error:', error);
      if (error.message === 'Failed to fetch') {
        notifySuccess('Ralat sambungan Cloud. Sila semak internet anda.');
      }
    }
  };

  const addStudent = (newStudent: Omit<Student, 'id'>) => {
    const studentWithId = { ...newStudent, id: Date.now().toString() };
    setStudents(prev => [...prev, studentWithId]);
    notifySuccess();
    setCurrentView('DATA_MURID');
  };

  const updateStudent = (updatedStudent: Student) => {
    setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
    notifySuccess();
  };

  const importStudents = (newStudents: Student[]) => {
    setStudents(prev => [...prev, ...newStudents]);
    notifySuccess();
    setCurrentView('DATA_MURID');
  };

  const updateAttendance = (studentId: string, date: string, status: 'PRESENT' | 'ABSENT', timeSlot: string) => {
    setAttendanceHistory(prev => [...prev.slice(-19), [...attendance]]);
    setAttendance(prev => {
      const filtered = prev.filter(a => !(a.studentId === studentId && a.date === date && a.timeSlot === timeSlot));
      return [...filtered, { studentId, date, status, timeSlot }];
    });
  };

  const bulkUpdateAttendance = (updates: { studentId: string; status: 'PRESENT' | 'ABSENT' }[], date: string, timeSlot: string) => {
    setAttendanceHistory(prev => [...prev.slice(-19), [...attendance]]);
    setAttendance(prev => {
      const studentIdsToUpdate = new Set(updates.map(u => u.studentId));
      const otherRecords = prev.filter(a => !(studentIdsToUpdate.has(a.studentId) && a.date === date && a.timeSlot === timeSlot));
      const newRecords = updates.map(u => ({ studentId: u.studentId, date, status: u.status, timeSlot }));
      return [...otherRecords, ...newRecords];
    });
  };

  const clearAttendance = (studentIds: string[], date: string, timeSlot: string) => {
    setAttendanceHistory(prev => [...prev.slice(-19), [...attendance]]);
    setAttendance(prev => prev.filter(a => !(studentIds.includes(a.studentId) && a.date === date && a.timeSlot === timeSlot)));
  };

  const clearAllAttendance = () => {
    if (confirm('ADAKAH ANDA PASTI? Storan aplikasi ini akan dikosongkan.')) {
      setAttendance([]);
      setAttendanceHistory([]);
      localStorage.removeItem('art_attendance');
      notifySuccess('Rekod kehadiran dikosongkan.');
    }
  };

  const undoAttendance = () => {
    if (attendanceHistory.length === 0) return;
    setAttendance(attendanceHistory[attendanceHistory.length - 1]);
    setAttendanceHistory(prev => prev.slice(0, -1));
  };

  const deleteStudent = (id: string) => {
    setStudents(prev => prev.filter(s => s.id !== id));
    notifySuccess();
  };

  const updateStudentNotes = (id: string, notes: string) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, notes } : s));
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'DASHBOARD':
        return (
          <Dashboard 
            students={students} 
            attendance={attendance} 
            onMark={updateAttendance} 
            onBulkMark={bulkUpdateAttendance}
            onClear={clearAttendance}
            onUndo={undoAttendance}
            canUndo={attendanceHistory.length > 0}
            onUpdateStudent={updateStudent}
            onSave={syncToGoogleSheets}
            isSaving={isSyncing}
            onRefresh={fetchAttendanceByDate}
          />
        );
      case 'CARIAN_ARKIB':
        return <ArchiveSearch googleScriptUrl={googleScriptUrl} attendance={attendance} spreadsheetId={spreadsheetId} />;
      case 'DATA_MURID':
        return <StudentList students={students} onDelete={deleteStudent} onUpdateNotes={updateStudentNotes} onUpdateStudent={updateStudent} />;
      case 'TAMBAH_MURID':
        return <AddStudent onAdd={addStudent} />;
      case 'IMPORT_MURID':
        return <ImportStudent onImport={importStudents} />;
      case 'RINGKASAN':
        return (
          <Summary 
            students={students} 
            attendance={attendance} 
            googleScriptUrl={googleScriptUrl}
            spreadsheetId={spreadsheetId}
            onImportCloudData={(newRecords) => {
              setAttendance(prev => {
                const existing = new Set(prev.map(p => `${p.studentId}-${p.date}-${p.timeSlot}`));
                const toAdd = newRecords.filter(n => !existing.has(`${n.studentId}-${n.date}-${n.timeSlot}`));
                return [...prev, ...toAdd];
              });
            }}
            onClearAll={clearAllAttendance}
          />
        );
      case 'MANUAL':
        return (
          <div className="bg-white p-4 sm:p-8 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3"><i className="fas fa-cog text-blue-600"></i>Konfigurasi & Manual</h2>
            
            <div className="space-y-8">
              <section className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                <h3 className="text-blue-900 font-bold mb-4 flex items-center gap-2"><i className="fas fa-cloud"></i> Tetapan Sambungan Cloud</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Google Script URL (Web App URL)</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl font-bold text-slate-700 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                      value={googleScriptUrl}
                      onChange={(e) => setGoogleScriptUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Spreadsheet ID</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl font-bold text-slate-700 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                      value={spreadsheetId}
                      onChange={(e) => setSpreadsheetId(e.target.value)}
                      placeholder="Contoh: 1Otr6yM4-Zx2ifK_s7Wd2ofu8pE05hN561zpqDM-RFCA"
                    />
                  </div>
                  <p className="text-[10px] text-blue-600 font-bold italic">
                    * Perubahan akan disimpan secara automatik. Sila pastikan URL berakhir dengan "/exec".
                  </p>
                  <button 
                    onClick={resetSettings}
                    className="mt-2 text-[10px] font-black text-blue-700 hover:text-blue-900 underline uppercase tracking-widest"
                  >
                    Set Semula ke Nilai Lalai
                  </button>
                </div>
              </section>

              <section className="bg-rose-50 p-6 rounded-2xl border border-rose-100">
                <h3 className="text-rose-900 font-bold mb-4 flex items-center gap-2"><i className="fas fa-exclamation-triangle"></i> Masih Mendapat "Failed to fetch"?</h3>
                <div className="space-y-4 text-xs text-rose-800 font-medium">
                  <p>Ralat ini 99% berpunca daripada tetapan di Google Apps Script. Sila ikuti langkah ini dengan teliti:</p>
                  <ol className="list-decimal list-inside space-y-2">
                    <li>Buka Editor Google Apps Script anda.</li>
                    <li>Klik butang biru <strong>Deploy</strong> di atas kanan.</li>
                    <li>Pilih <strong>New Deployment</strong>.</li>
                    <li>Klik ikon gear (Select type) dan pilih <strong>Web App</strong>.</li>
                    <li><strong>PENTING:</strong> Di bahagian "Who has access", pilih <strong>Anyone</strong>. (Jangan pilih "Only myself" atau "Anyone with Google account").</li>
                    <li>Klik <strong>Deploy</strong>.</li>
                    <li>Salin <strong>Web App URL</strong> yang baru dan tampal di kotak tetapan di atas.</li>
                  </ol>
                  <div className="bg-white/50 p-3 rounded-xl border border-rose-200 mt-4">
                    <p className="font-black uppercase text-[10px] mb-1">Kenapa "Anyone"?</p>
                    <p className="text-[10px] leading-relaxed">Tanpa tetapan "Anyone", Google akan menyekat permintaan daripada aplikasi ini (CORS error). Ini adalah langkah keselamatan standard Google untuk aplikasi web pihak ketiga.</p>
                  </div>
                </div>
              </section>

              <section className="bg-indigo-50 p-4 sm:p-6 rounded-2xl border border-indigo-100">
                <h3 className="text-indigo-900 font-bold mb-4 flex items-center gap-2 text-sm sm:text-base"><i className="fas fa-code"></i> SILA GANTI KOD APPS SCRIPT ANDA DENGAN KOD DI BAWAH (VERSI PEMADAMAN & CARIAN ROBUST):</h3>
                <pre className="bg-slate-900 text-slate-300 p-3 sm:p-4 rounded-xl text-[9px] sm:text-[10px] overflow-x-auto font-mono leading-relaxed">
{`function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(params.spreadsheetId);
    var sheet = ss.getSheets()[0];
    
    // Fungsi utiliti untuk format tarikh yang selamat
    function formatDateSafe(val) {
      if (!val) return "";
      var d = new Date(val);
      if (isNaN(d.getTime())) return val.toString().trim();
      return Utilities.formatDate(d, "GMT+8", "yyyy-MM-dd");
    }
    
    if (params.action == 'sync_attendance') {
      var data = sheet.getDataRange().getValues();
      var targetDate = params.targetDate;
      var timeSlot = params.timeSlot;
      var roomName = params.roomName;

      var daysMalay = ['AHAD', 'ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT', 'SABTU'];
      var dateObj = new Date(targetDate);
      var dayName = daysMalay[dateObj.getDay()];

      for (var i = data.length - 1; i >= 1; i--) {
        var rowDate = formatDateSafe(data[i][0]);
        var rowTime = (data[i][2] || "").toString().trim();
        var rowRoom = (data[i][10] || "").toString().trim();
        
        if (rowDate == targetDate && rowTime == timeSlot.toString().trim() && rowRoom == roomName.toString().trim()) {
          sheet.deleteRow(i + 1);
        }
      }

      params.attendance.forEach(function(rec) {
        var student = params.students.find(s => s.id === rec.studentId);
        if (student) {
          sheet.appendRow([
            targetDate,          
            dayName,             
            timeSlot,            
            params.coachName,    
            student.role || "MURID", 
            student.form,        
            student.group,       
            student.name,        
            rec.status === 'PRESENT' ? 'HADIR' : 'TIDAK HADIR', 
            student.notes || "", 
            roomName             
          ]);
        }
      });
      return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
    }

    if (params.action == 'search_attendance') {
      var data = sheet.getDataRange().getValues();
      var results = [];
      var searchDate = params.targetDate;
      
      for (var i = 1; i < data.length; i++) {
        var rowDate = formatDateSafe(data[i][0]);
        if (rowDate == searchDate) {
          results.push({
            date: rowDate,
            day: (data[i][1] || "").toString().trim(),
            timeSlot: (data[i][2] || "").toString().trim(),
            coachName: (data[i][3] || "").toString().trim(),
            role: (data[i][4] || "").toString().trim(),
            form: (data[i][5] || "").toString().trim(),
            group: (data[i][6] || "").toString().trim(),
            name: (data[i][7] || "").toString().trim(),
            status: (data[i][8] || "").toString().trim(),
            notes: (data[i][9] || "").toString().trim(),
            roomName: (data[i][10] || "").toString().trim()
          });
        }
      }
      return ContentService.createTextOutput(JSON.stringify(results)).setMimeType(ContentService.MimeType.JSON);
    }

    if (params.action == 'delete_attendance') {
      var data = sheet.getDataRange().getValues();
      var deletedCount = 0;
      var targetDate = params.targetDate;
      
      for (var i = data.length - 1; i >= 1; i--) {
        var rowDate = formatDateSafe(data[i][0]);
        
        // Normalisasi data dari sheet untuk perbandingan yang tepat
        var rowTime = (data[i][2] || "").toString().trim().toUpperCase();
        var rowCoach = (data[i][3] || "").toString().trim().toUpperCase();
        var rowGroup = (data[i][6] || "").toString().trim().toUpperCase();
        var rowRoom = (data[i][10] || "").toString().trim().toUpperCase();
        
        var matchDate = (rowDate == targetDate);
        var matchTime = (!params.timeSlot || params.timeSlot == "" || rowTime == params.timeSlot.toString().trim().toUpperCase());
        var matchRoom = (!params.roomName || params.roomName == "" || rowRoom == params.roomName.toString().trim().toUpperCase());
        var matchGroup = (!params.group || params.group == "" || rowGroup == params.group.toString().trim().toUpperCase());
        var matchCoach = (!params.coachName || params.coachName == "" || rowCoach == params.coachName.toString().trim().toUpperCase());
        
        if (matchDate && matchTime && matchRoom && matchGroup && matchCoach) {
          sheet.deleteRow(i + 1);
          deletedCount++;
        }
      }
      return ContentService.createTextOutput("OK: " + deletedCount + " rekod dipadam.").setMimeType(ContentService.MimeType.TEXT);
    }
    
    return ContentService.createTextOutput("ERROR: Action tidak dikenali").setMimeType(ContentService.MimeType.TEXT);
    
  } catch (err) {
    return ContentService.createTextOutput("ERROR: " + err.toString()).setMimeType(ContentService.MimeType.TEXT);
  }
}`}
                </pre>
              </section>
            </div>
          </div>
        );
      default:
        return <Dashboard students={students} attendance={attendance} onMark={updateAttendance} onBulkMark={bulkUpdateAttendance} onClear={clearAttendance} onUndo={undoAttendance} canUndo={attendanceHistory.length > 0} onUpdateStudent={updateStudent} onSave={syncToGoogleSheets} isSaving={isSyncing} onRefresh={fetchAttendanceByDate} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden relative">
      <Sidebar 
        currentView={currentView} 
        setView={setCurrentView} 
        onLogout={() => setIsAuthenticated(false)} 
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header 
          currentView={currentView} 
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />
        <main className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-8 relative">
          {showToast && <div className="fixed top-20 right-4 sm:right-8 z-50 bg-emerald-500 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce"><i className="fas fa-check-circle"></i><span className="font-bold text-xs sm:text-sm">{toastMsg}</span></div>}
          <div className="max-w-6xl mx-auto w-full">{renderView()}</div>
        </main>
      </div>
    </div>
  );
};

export default App;
