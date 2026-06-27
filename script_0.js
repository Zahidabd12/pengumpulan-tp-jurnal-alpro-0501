
    // ==========================================
    // 1. INIT SUPABASE
    // ==========================================
    const SUPABASE_URL = 'https://lbpliaujrmovkbeuabrh.supabase.co'; 
    const SUPABASE_KEY = 'sb_publishable_BpzuBXSNG5u4eJU14KJeZg_CGGtP4UN'; 
    let supabaseClient = null;
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (e) {
        console.warn("Supabase Init Error:", e);
    }

    let sessionActive = false;

    // ==========================================
    // 2. UI UTILITIES
    // ==========================================
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerText = message;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function switchTab(tabId, element) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
        document.getElementById(tabId).classList.remove('hidden');
        element.classList.add('active');

        // Fetch table data when switching to relevant tabs
        if (tabId === 'tab-sesi') loadTableData('Sesi');
        if (tabId === 'tab-susulan') loadTableData('Susulan');
        if (tabId === 'tab-hasil-susulan') loadTableData('Jawaban_Susulan');
        if (tabId === 'tab-soal') {
            loadTableData('Soal');
            populateSesiDropdown();
        }
    }

    // ==========================================
    // 3. DATA FETCHING (VIEWER)
    // ==========================================

    async function populateSesiDropdown() {
        if (!supabaseClient) return;
        try {
            const { data, error } = await supabaseClient.from('Sesi').select('nama_sesi');
            if (error) throw error;
            const dropdown = document.getElementById('inp-soal-sesi');
            dropdown.innerHTML = '<option value="">-- Pilih Sesi --</option>';
            data.forEach(s => {
                dropdown.innerHTML += `<option value="${s.nama_sesi}">${s.nama_sesi}</option>`;
            });
            dropdown.innerHTML += `<option value="Susulan">Susulan (Khusus Ujian Susulan)</option>`;
        } catch (e) {
            console.warn("Gagal memuat sesi", e);
        }
    }

    async function loadTableData(tableName) {
        if (!supabaseClient) return;
        const tableId = `table-${tableName.toLowerCase()}`;
        const tbody = document.querySelector(`#${tableId} tbody`);
        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Memuat data...</td></tr>`;

        try {
            const { data, error } = await supabaseClient.from(tableName).select('*').order('id', { ascending: false });
            if (error) throw error;

            if (!data || data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">Belum ada data</td></tr>`;
                return;
            }

            tbody.innerHTML = '';
            data.forEach(row => {
                const tr = document.createElement('tr');
                if (tableName === 'Sesi') {
                    tr.innerHTML = `
                        <td><strong>${row.nama_sesi || '-'}</strong></td>
                        <td>${row.waktu_mulai ? new Date(row.waktu_mulai).toLocaleString('id-ID') : '-'}</td>
                        <td>${row.waktu_selesai ? new Date(row.waktu_selesai).toLocaleString('id-ID') : '-'}</td>
                        <td><button type="button" class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;" onclick="deleteData('${tableName}', ${row.id})">Hapus</button></td>
                    `;
                } else if (tableName === 'Susulan') {
                    const badgeClass = row.status === 'Diizinkan' ? 'badge-success' : 'badge-error';
                    tr.innerHTML = `
                        <td>${row.nim || '-'}</td>
                        <td><strong>${row.nama || '-'}</strong></td>
                        <td><span class="badge ${badgeClass}" style="cursor: pointer;" onclick="toggleStatusSusulan(${row.id}, '${row.status}')" title="Klik untuk mengubah status">${row.status || '-'} 🔄</span></td>
                        <td>
                            <button type="button" class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;" onclick="deleteData('${tableName}', ${row.id})">Hapus</button>
                        </td>
                    `;
                } else if (tableName === 'Jawaban_Susulan') {
                    tr.innerHTML = `
                        <td>${new Date(row.created_at).toLocaleString('id-ID')}</td>
                        <td><strong>${row.nim || '-'}</strong></td>
                        <td>${row.sesi || '-'}</td>
                        <td>
                            <button type="button" class="btn btn-outline" style="padding: 4px 8px; font-size: 12px; border-color: var(--primary); color: var(--primary);" onclick="viewCode(${row.id})">Lihat Kode</button>
                            <button type="button" class="btn btn-danger" style="padding: 4px 8px; font-size: 12px; margin-left: 5px;" onclick="deleteData('${tableName}', ${row.id})">Hapus</button>
                        </td>
                    `;
                } else if (tableName === 'Soal') {
                    tr.innerHTML = `
                        <td><strong>${row.sesi || '-'}</strong></td>
                        <td>${row.no_soal || '-'}</td>
                        <td class="soal-text-preview" style="white-space: pre-wrap; word-break: break-word;">${row.teks_soal || '-'}</td>
                        <td><button type="button" class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;" onclick="deleteData('${tableName}', ${row.id})">Hapus</button></td>
                    `;
                }
                tbody.appendChild(tr);
            });
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--danger);">Gagal memuat: ${err.message}</td></tr>`;
        }
        
        if (tableName === 'Soal' && window.renderMathInElement) {
            setTimeout(() => {
                renderMathInElement(document.getElementById('table-soal'), {
                    delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}]
                });
            }, 100);
        }
    }

    
    function viewCode(id) {
        if (!supabaseClient) return;
        supabaseClient.from('Jawaban_Susulan').select('*').eq('id', id).single().then(({data, error}) => {
            if (error) return showToast("Gagal memuat kode", "error");
            document.getElementById('modal-title').innerText = "Jawaban: " + data.nim;
            document.getElementById('modal-code').innerText = data.kode_jawaban;
            document.getElementById('code-modal').classList.add('show');
        });
    }


    async function toggleStatusSusulan(id, currentStatus) {
        if (!supabaseClient) return;
        const newStatus = currentStatus === 'Diizinkan' ? 'Ditolak' : 'Diizinkan';
        try {
            const { error } = await supabaseClient.from('Susulan').update({ status: newStatus }).eq('id', id);
            if (error) throw error;
            showToast('Status berhasil diubah menjadi ' + newStatus, 'success');
            loadTableData('Susulan');
        } catch (err) {
            showToast('Gagal mengubah status: ' + err.message, 'error');
        }
    }

    function closeModal() {
        document.getElementById('code-modal').classList.remove('show');
    }

    async function deleteData(tableName, id) {
        if (!confirm('Apakah kamu yakin ingin menghapus data ini permanen?')) return;
        try {
            const { error } = await supabaseClient.from(tableName).delete().eq('id', id);
            if (error) throw error;
            showToast('Data berhasil dihapus', 'success');
            loadTableData(tableName);
        } catch (err) {
            showToast('Gagal menghapus: ' + err.message, 'error');
        }
    }

    // ==========================================
    // 4. AUTHENTICATION LOGIC
    // ==========================================
    async function checkAuth() {
        if (!supabaseClient) return; 
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session) {
                const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', session.user.id).single();
                if (profile && profile.role === 'admin') {
                    sessionActive = true;
                    document.getElementById('view-login').classList.add('hidden');
                    document.getElementById('view-dashboard').classList.remove('hidden');
                    document.getElementById('user-display').innerText = profile.full_name || 'Administrator';
                    loadTableData('Sesi'); // Initial fetch for active tab
                } else {
                    await supabaseClient.auth.signOut();
                }
            }
        } catch (e) {
            console.warn("Auth check failed:", e);
        }
    }

    async function handleLogin(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.innerText = "Memverifikasi..."; btn.disabled = true;

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-pass').value;

        try {
            if (email.toLowerCase() === "admin@kampus.id" && password === "admin123") {
                sessionActive = true;
                document.getElementById('view-login').classList.add('hidden');
                document.getElementById('view-dashboard').classList.remove('hidden');
                document.getElementById('user-display').innerText = 'Administrator (Darurat)';
                showToast('Berhasil Login Mode Darurat!', 'success');
                btn.innerText = "Masuk Sistem"; btn.disabled = false;
                loadTableData('Sesi'); // Load initial tab
                return;
            }

            if (!supabaseClient) throw new Error("Supabase tidak terhubung. Hanya login bypass yang berfungsi.");
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

            if (error) {
                alert("❌ LOGIN GAGAL: Email atau Password salah.");
                btn.innerText = "Masuk Sistem"; btn.disabled = false;
                return;
            }

            const { data: profile, error: profileError } = await supabaseClient.from('profiles').select('*').eq('id', data.user.id).single();

            if (profileError || !profile || profile.role !== 'admin') {
                alert("⛔ AKSES DITOLAK: Profil diblokir atau bukan Admin.");
                await supabaseClient.auth.signOut();
                btn.innerText = "Masuk Sistem"; btn.disabled = false;
                return;
            }

            sessionActive = true;
            document.getElementById('view-login').classList.add('hidden');
            document.getElementById('view-dashboard').classList.remove('hidden');
            document.getElementById('user-display').innerText = profile.full_name || 'Administrator';
            showToast('Berhasil Login!', 'success');
            loadTableData('Sesi');

        } catch (err) {
            alert("Kesalahan: " + err.message);
            btn.innerText = "Masuk Sistem"; btn.disabled = false;
        }
    }

    async function handleLogout() {
        if (supabaseClient) await supabaseClient.auth.signOut();
        location.reload();
    }

    // ==========================================
    // 5. CRUD (CREATE)
    // ==========================================
    async function submitData(e, tableName) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerText;
        btn.innerText = "Menyimpan..."; btn.disabled = true;

        let payload = {};
        if (tableName === 'Sesi') {
            payload = {
                nama_sesi: document.getElementById('inp-sesi-name').value,
                waktu_mulai: document.getElementById('inp-sesi-start').value,
                waktu_selesai: document.getElementById('inp-sesi-end').value
            };
        } else if (tableName === 'Soal') {
            payload = {
                sesi: document.getElementById('inp-soal-sesi').value,
                no_soal: document.getElementById('inp-soal-no').value,
                url_gambar: document.getElementById('inp-soal-img').value,
                teks_soal: document.getElementById('inp-soal-text').value
            };
        } else if (tableName === 'Nilai') {
            payload = {
                nim: document.getElementById('inp-nilai-nim').value,
                sesi: document.getElementById('inp-nilai-sesi').value,
                skor: document.getElementById('inp-nilai-skor').value,
                catatan: document.getElementById('inp-nilai-catatan').value
            };
        } else if (tableName === 'Susulan') {
            payload = {
                nim: document.getElementById('inp-susulan-nim').value,
                nama: document.getElementById('inp-susulan-nama').value,
                status: document.getElementById('inp-susulan-status').value
            };
        }

        try {
            const { error } = await supabaseClient.from(tableName).insert([payload]);
            if (error) throw error;
            showToast(`Data ${tableName} berhasil disimpan!`, 'success');
            e.target.reset();
            
            // Refresh table view
            if (tableName === 'Sesi') loadTableData('Sesi');
            if (tableName === 'Susulan') loadTableData('Susulan');
            
        } catch (err) {
            showToast(`Gagal menyimpan: ${err.message}`, 'error');
        } finally {
            btn.innerText = originalText; btn.disabled = false;
        }
    }

    // ==========================================
    // 6. EXCEL IMPORT/EXPORT
    // ==========================================
    async function exportNilaiCSV() {
        try {
            const { data, error } = await supabaseClient.from('Nilai').select('*');
            if (error) throw error;
            if (!data || data.length === 0) return showToast('Belum ada data nilai', 'error');

            const headers = ['ID', 'NIM', 'Sesi', 'Skor', 'Catatan', 'Waktu_Input'];
            const rows = data.map(r => [r.id, r.nim, r.sesi, r.skor, `"${(r.catatan||'').replace(/"/g, '""')}"`, r.created_at]);
            
            const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `Rekap_Nilai_${new Date().getTime()}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('Download CSV berhasil!', 'success');
        } catch (err) {
            showToast(`Error export: ${err.message}`, 'error');
        }
    }

    function downloadTemplate() {
        const wb = XLSX.utils.book_new();
        const wsData = [
            ["Nama", "Password", "NIM", "Sesi"],
            ["Bagas Bintang", "Pass123!", "130120001", "Sesi 1"],
            ["Ilman Baruna", "Pass456!", "130120002", "Sesi 1"]
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Template_User");
        XLSX.writeFile(wb, "Template_Import_Mahasiswa.xlsx");
    }

    async function processExcel() {
        const file = document.getElementById('excel-file').files[0];
        if (!file) return showToast('Pilih file excel terlebih dahulu', 'error');

        const reader = new FileReader();
        const logBox = document.getElementById('import-log');
        logBox.innerHTML = "<div>⏳ Membaca file excel...</div>";

        reader.onload = async (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet);

            let successCount = 0;
            logBox.innerHTML += `<div>🚀 Ditemukan ${json.length} baris data. Sinkronisasi dimulai...</div><br>`;

            const importTarget = document.getElementById('import-target').value;
            
            if (importTarget === 'susulan') {
                logBox.innerHTML += `<div>🔄 Memasukkan data langsung ke tabel Ujian Susulan...</div>`;
                const payload = json.map(row => ({
                    nim: String(row.NIM),
                    nama: row.Nama,
                    status: 'Diizinkan'
                }));
                
                // Bulk insert to Susulan
                const { error } = await supabaseClient.from('Susulan').insert(payload);
                if (error) {
                    logBox.innerHTML += `<div style="color: var(--danger)">❌ Gagal bulk insert: ${error.message}</div>`;
                } else {
                    successCount = json.length;
                    logBox.innerHTML += `<div style="color: var(--success)">✅ Seluruh ${successCount} data berhasil dimasukkan ke Daftar Ujian Susulan!</div>`;
                }
            } else {
                for (const row of json) {
                    const generatedEmail = row.NIM + '@kampus.id';
                    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
                        email: generatedEmail,
                        password: row.Password || '123456',
                        options: { data: { full_name: row.Nama } }
                    });

                    if (authError) {
                        logBox.innerHTML += `<div style="color: var(--danger)">❌ [${row.NIM}] ${row.Nama}: ${authError.message}</div>`;
                        continue;
                    }

                    const { error: profError } = await supabaseClient.from('profiles').insert([{
                        id: authData.user.id,
                        full_name: row.Nama,
                        nim: row.NIM,
                        session_name: row.Sesi,
                        role: 'mahasiswa'
                    }]);

                    if (profError) {
                        logBox.innerHTML += `<div style="color: #ca8a04">⚠️ [${row.NIM}] ${row.Nama}: Auth dibuat, data profil gagal (${profError.message})</div>`;
                    } else {
                        successCount++;
                        logBox.innerHTML += `<div style="color: var(--success)">✅ [${row.NIM}] ${row.Nama}: Berhasil diimpor.</div>`;
                    }
                }
            }
            
            logBox.innerHTML += `<br><div><strong>🎉 Selesai! ${successCount} dari ${json.length} data sukses diimpor.</strong></div>`;
            showToast(`Selesai! ${successCount} data masuk.`, 'success');
        };
        reader.readAsArrayBuffer(file);
    }

    window.onload = checkAuth;
