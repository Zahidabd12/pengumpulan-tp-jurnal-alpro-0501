
  // --- SUPABASE INIT ---
  const SUPABASE_URL = 'https://lbpliaujrmovkbeuabrh.supabase.co'; 
  const SUPABASE_KEY = 'sb_publishable_BpzuBXSNG5u4eJU14KJeZg_CGGtP4UN'; 
  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  let studentData = { nim: '', nama: '', sesi: '' };
  let isExamActive = false;
  let stream = null;
  let examIntervalTimer = null;
  let soalList = [];

  function startCamera() {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(s => {
        stream = s;
        const video = document.getElementById('webcam-view');
        video.srcObject = stream;
        video.style.display = 'block';
      })
      .catch(err => {
        alert("Akses kamera diwajibkan untuk pengawasan ujian! Silakan izinkan kamera dan muat ulang halaman.");
        location.reload();
      });
  }

  let violationCount = 0;

  function handleViolation() {
    if (!isExamActive) return;
    violationCount++;
    document.getElementById('violation-count').innerText = violationCount;
    document.getElementById('screen-fs-warning').style.display = 'flex';
  }

  // --- FULLSCREEN & FOCUS LOGIC ---
  function enterFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) elem.requestFullscreen();
    else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
    else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
  }

  function resumeFullscreen() {
    enterFullscreen();
    document.getElementById('screen-fs-warning').style.display = 'none';
  }

  document.addEventListener('fullscreenchange', () => {
    if (isExamActive && !document.fullscreenElement) handleViolation();
  });
  document.addEventListener('visibilitychange', () => {
    if (isExamActive && document.hidden) handleViolation();
  });
  window.addEventListener('blur', () => {
    if (isExamActive) handleViolation();
  });

  // --- VALIDASI PESERTA ---
  async function checkJadwal() {
    const nim = document.getElementById('inp-nim').value.trim();
    
    if(!nim) return alert("NIM wajib diisi!");
    
    const btn = document.getElementById('btn-login');
    btn.innerText = "Memvalidasi... ⏳"; btn.disabled = true;

    try {
        const { data, error } = await supabaseClient.from('Susulan').select('*').eq('nim', nim).single();
        
        if (error || !data) {
            throw new Error("NIM tidak ditemukan dalam daftar peserta Susulan.");
        }
        
        if (data.status !== 'Diizinkan') {
            throw new Error("Akses ditolak. Status kamu: " + data.status);
        }

        studentData = { nim: data.nim, nama: data.nama, sesi: "Susulan" };
        
        document.getElementById('screen-login').style.display = 'none';
        document.getElementById('screen-lobby').style.display = 'block';
        document.getElementById('lobby-msg').innerText = `Halo, ${data.nama}!`;
        
        startCamera(); // Nyalakan kamera saat masuk lobby

    } catch (err) {
        alert("Gagal: " + err.message);
        btn.innerText = "Validasi Peserta"; 
        btn.disabled = false;
    }
  }

  // --- AMBIL SOAL ---
  async function fetchSoal() {
    enterFullscreen();
    const btn = document.getElementById('btn-start');
    btn.innerText = "Memuat Soal... ⏳"; btn.disabled = true;
    
    try {
        const { data, error } = await supabaseClient.from('Soal').select('*').order('no_soal', { ascending: true });
        
        if (error) throw error;
        if (!data || data.length === 0) throw new Error("Tidak ada soal ditemukan untuk sesi ini.");

        soalList = data;
        
        isExamActive = true;
        document.getElementById('screen-lobby').style.display = 'none';
        document.getElementById('exam-header').style.display = 'flex';
        document.getElementById('screen-soal').style.display = 'block';
        
        document.getElementById('user-display').innerText = studentData.nama;
        document.getElementById('sesi-display').innerText = studentData.sesi;
        
        let html = "";
        data.forEach(q => {
          html += `
            <div class="q-card">
              <span class="q-number">SOAL ${q.no_soal}</span>
              <div class="q-text">${q.teks_soal.replace(/\\n/g, '<br>')}</div>
              ${q.url_gambar ? `<img src="${q.url_gambar}" class="q-img">` : ""}
              
              <div style="margin-top: 20px;">
                  <label style="color: #94a3b8; font-size: 13px; font-weight: 600;">Tulis Kode Jawaban Di Sini:</label>
                  <textarea class="code-editor" id="answer-${q.no_soal}" placeholder="// Ketik kode jawaban untuk Soal ${q.no_soal} di sini...">${q.template_jawaban || ""}</textarea>
              </div>
            </div>`;
        });
                document.getElementById('questions-container').innerHTML = html;
        
        // --- ADD TAB INDENTATION LOGIC ---
        document.querySelectorAll('.code-editor').forEach(editor => {
            editor.addEventListener('keydown', function(e) {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = this.selectionStart;
                    const end = this.selectionEnd;
                    this.value = this.value.substring(0, start) + "    " + this.value.substring(end);
                    this.selectionStart = this.selectionEnd = start + 4;
                }
            });
        });
        
        if(window.renderMathInElement) renderMathInElement(document.getElementById('questions-container'), {
            delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}]
        });
        
        startTimer(120); // Set default timer 120 menit (Bisa disesuaikan nanti)

    } catch (err) {
        alert("Gagal memuat soal: " + err.message);
        btn.innerText = "Mulai Ujian Sekarang 🚀"; btn.disabled = false;
    }
  }

  function startTimer(minutes) {
    let timeLeft = minutes * 60;
    const timerEl = document.getElementById('main-timer');
    
    examIntervalTimer = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(examIntervalTimer);
            submitAnswers(true); // Force submit
        } else {
            if (timeLeft < 300) timerEl.classList.add('danger');
            const h = Math.floor(timeLeft / 3600);
            const m = Math.floor((timeLeft % 3600) / 60);
            const s = Math.floor(timeLeft % 60);
            timerEl.innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        }
    }, 1000);
  }

  // --- PENGUMPULAN ---
  async function submitAnswers(isForce = false) {
      if (!isForce && !confirm("Apakah kamu yakin sudah selesai? Jawaban yang sudah dikumpulkan tidak bisa diubah!")) return;
      
      isExamActive = false;
      if(examIntervalTimer) clearInterval(examIntervalTimer);
      
      const btn = document.getElementById('btn-submit');
      if(btn) { btn.innerText = "Mengumpulkan... ⏳"; btn.disabled = true; }

      // Kumpulkan semua jawaban dari textarea
      let combinedAnswers = `=== JAWABAN SUSULAN ===\nNIM: ${studentData.nim}\nNama: ${studentData.nama}\nSesi: ${studentData.sesi}\n\n`;
      
      let totalBenar = 0;
      let totalSoalDiperiksa = 0;

      const normalizeCode = (str) => {
          if (!str) return "";
          return str.replace(/\r\n/g, '\n').trim();
      };

      soalList.forEach(q => {
          const rawAnswer = document.getElementById(`answer-${q.no_soal}`).value || "";
          let gradingMark = "";
          
          if (q.kunci_jawaban) {
              totalSoalDiperiksa++;
              const isCorrect = normalizeCode(rawAnswer) === normalizeCode(q.kunci_jawaban);
              if (isCorrect) {
                  totalBenar++;
                  gradingMark = "[KOREKSI OTOMATIS: BENAR ✅]\n";
              } else {
                  gradingMark = "[KOREKSI OTOMATIS: SALAH ❌]\n";
              }
          } else {
              gradingMark = "[TIDAK ADA KUNCI JAWABAN]\n";
          }
          
          combinedAnswers += `--- SOAL ${q.no_soal} ---\n${gradingMark}${rawAnswer || "// Tidak ada jawaban"}\n\n`;
      });
      
      if (totalSoalDiperiksa > 0) {
          const nilaiAkhir = Math.round((totalBenar / totalSoalDiperiksa) * 100);
          combinedAnswers = `NILAI AKHIR: ${nilaiAkhir}/100 (${totalBenar} dari ${totalSoalDiperiksa} Benar)\n=========================\n` + combinedAnswers;
      }
      

      try {
          const { error } = await supabaseClient.from('Jawaban_Susulan').insert([{
              nim: studentData.nim,
              sesi: studentData.sesi,
              kode_jawaban: combinedAnswers
          }]);
          
          if (error) throw error;

          if (stream) stream.getTracks().forEach(track => track.stop());
          document.getElementById('webcam-view').style.display = 'none';
          document.getElementById('exam-header').style.display = 'none';
          document.getElementById('screen-soal').style.display = 'none';
          
          document.getElementById('screen-timeout').style.display = 'block';
          if(isForce) {
              document.getElementById('timeout-title').innerText = "WAKTU HABIS!";
              document.getElementById('timeout-title').style.color = "var(--danger)";
              document.getElementById('timeout-desc').innerText = "Waktu habis. Jawaban terakhir kamu telah dikumpulkan otomatis.";
          }

      } catch (err) {
          alert("GAGAL MENGUMPULKAN JAWABAN: " + err.message + "\n\nSilakan simpan kode kamu secara manual dan hubungi asisten!");
          if(btn) { btn.innerText = "Kumpulkan Semua Jawaban"; btn.disabled = false; }
      }
  }

  // Anti-Inspect & Anti-Cheating
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) || (e.ctrlKey && e.key === 'u')) e.preventDefault();
  });
  document.addEventListener('copy', e => e.preventDefault());
  document.addEventListener('cut', e => e.preventDefault());
  document.addEventListener('paste', e => e.preventDefault());
  document.addEventListener('dragstart', e => e.preventDefault());
