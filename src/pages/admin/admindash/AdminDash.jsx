import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { supabase } from "../../../supabase/client";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { 
  FaUsers, FaTools, FaGift, FaUserClock, 
  FaRandom, FaCogs, 
  FaSignOutAlt, FaBars, FaTimes, FaFilePdf, FaCheckCircle, FaCalendarAlt
} from "react-icons/fa";

import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip 
} from "recharts";

import "./adminDash.css";

export default function AdminDash() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [stats, setStats] = useState({ totalUsers: 0, activeMasters: 0, pendingBonus: 0, newClients: 0 });
  const [topMasters, setTopMasters] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [mastersList, setMastersList] = useState([]);
  
  // Kod generator holatlari (Baza bilan bog'langan)
  const [codeQuantity, setCodeQuantity] = useState("");
  const [allPromoCodes, setAllPromoCodes] = useState([]); // Bazadagi barcha kodlar
  const [generationDate, setGenerationDate] = useState(""); 
  
  // const [startDate, setStartDate] = useState("");
  // const [endDate, setEndDate] = useState("");
  // const [bonusTitle, setBonusTitle] = useState("");
  // const [bonusDuration, setBonusDuration] = useState("3");

  const navigate = useNavigate();

  // Bazadan barcha ma'lumotlarni qayta tiklash (Sahifa yangilanganda o'chmasligi uchun)
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Ustalar soni
      const { count: usersCount, error: countError } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });
        
      if (countError) throw countError;

      // 2. Kutilayotgan arizalar (Userlar kiritgan kodlar)
      const { data: pendingData, error: pendingError } = await supabase
        .from("used_codes")
        .select(`
          id,
          created_at,
          user_id,
          profiles (full_name, phone, region, bonus),
          promo_codes (code)
        `)
        .order("created_at", { ascending: false });

      const actualPendingRequests = pendingError ? [] : (pendingData || []);
      setPendingRequests(actualPendingRequests);

      setStats({
        totalUsers: usersCount || 0,
        activeMasters: Math.floor((usersCount || 0) * 0.8), 
        pendingBonus: actualPendingRequests.length,
        newClients: Math.floor((usersCount || 0) * 0.1)
      });

      // 3. Ustalar ro'yxati va ballari
      const { data: profiles, error: profError } = await supabase
        .from("profiles")
        .select("*")
        .order("bonus", { ascending: false });

      if (profError) throw profError;
      const actualProfiles = profiles || [];
      setMastersList(actualProfiles);

      const chartData = actualProfiles.slice(0, 5).map(u => ({
        name: u.full_name || u.phone || "Noma'lum",
        ball: u.bonus || 0
      }));
      setTopMasters(chartData);

      // 4. Bazadagi barcha generatsiya qilingan kodlarni yuklash (O'chib ketmasligi uchun)
      const { data: promoCodesData, error: promoError } = await supabase
        .from("promo_codes")
        .select("*")
        .order("created_at", { ascending: false });

      if (!promoError && promoCodesData) {
        setAllPromoCodes(promoCodesData);
        if (promoCodesData.length > 0) {
          const lastDate = new Date(promoCodesData[0].created_at);
          setGenerationDate(`${lastDate.getDate()}.${lastDate.getMonth() + 1}.${lastDate.getFullYear()} soat ${lastDate.getHours()}:${String(lastDate.getMinutes()).padStart(2, '0')}`);
        }
      }

    } catch (error) {
      console.error("Ma'lumotlarni yuklashda xatolik:", error);
      toast.error("Ma'lumotlar sinxronizatsiyasida xatolik");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkAdmin = async () => {
      const storedUser = localStorage.getItem("user");
      if (!storedUser) {
        navigate("/login");
        return;
      }
      try {
        const user = JSON.parse(storedUser);
        if (user.role !== "admin") {
          toast.error("Siz admin emassiz!");
          navigate("/user-dashboard");
          return;
        }
        await fetchDashboardData();
      } catch (e) {
        navigate("/login");
      }
    };

    checkAdmin();
  }, [navigate, fetchDashboardData]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    toast.info("Tizimdan chiqdingiz");
    navigate("/login");
  };

  // Kodlarni generatsiya qilish
  const handleGenerateCodes = async () => {
    const qty = parseInt(codeQuantity, 10);
    if (!qty || qty <= 0 || qty > 1000) {
      toast.error("Iltimos, to'g'ri miqdor kiriting (Maksimal: 1,000)!");
      return;
    }

    setLoading(true);
    const codesSet = new Set();
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    while (codesSet.size < qty) {
      let result = "";
      for (let i = 0; i < 8; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      codesSet.add(result);
    }

    const finalCodesArray = Array.from(codesSet).map(code => ({
      code: code,
      is_active: true
    }));

    try {
      const { error } = await supabase.from("promo_codes").insert(finalCodesArray);
      if (error) throw error;

      toast.success(`${qty} ta yangi unikal kod bazaga yozildi! 🎉`);
      setCodeQuantity("");
      await fetchDashboardData(); // Bazani darhol yangilash
    } catch (err) {
      toast.error("Kodlarni saqlashda xatolik: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // PDF eksport qilish
  const exportToPDF = () => {
    if (allPromoCodes.length === 0) return;

    const doc = new jsPDF();
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.text("PROMO CODES REPORT", 14, 20);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Hisobot vaqti: ${generationDate || 'Hozir'}`, 14, 28);
    doc.text(`Umumiy kodlar soni: ${allPromoCodes.length} ta`, 14, 35);
    
    const tableRows = allPromoCodes.map((c, index) => [
      index + 1, 
      c.code, 
      c.is_active ? "Faol (Ishlatilmagan)" : "Ishlatilgan / Kutilmoqda"
    ]);
    
    autoTable(doc, {
      startY: 42,
      head: [["#", "Promo Code", "Status"]],
      body: tableRows,
      theme: "grid",
      headStyles: { fillColor: [15, 23, 42], fontSize: 11, fontStyle: "bold" },
      bodyStyles: { fontSize: 11, textColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    
    doc.save(`Barcha_Kodlar_Hisoboti.pdf`);
    toast.success("PDF yuklab olindi! 📄");
  };

  // Usta kodini tasdiqlash va unga +1 ball qo'shish
  const handleApproveBonus = async (requestId, userId, currentBonus) => {
    try {
      // Foydalanuvchining ballini 1 taga oshirish
      const { error: userError } = await supabase
        .from("profiles")
        .update({ bonus: (currentBonus || 0) + 1 })
        .eq("id", userId);

      if (userError) throw userError;

      // Arizani kutilayotganlar ro'yxatidan o'chirish
      const { error: deleteError } = await supabase
        .from("used_codes")
        .delete()
        .eq("id", requestId);

      if (deleteError) throw deleteError;

      toast.success("Usta balli muvaffaqiyatli tasdiqlandi va yangilandi! 🔥");
      await fetchDashboardData();
    } catch (err) {
      toast.error("Tasdiqlashda xatolik: " + err.message);
    }
  };

  return (
    <div className="dash-container">
      <button className="mobile-menu-toggle" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
        {isMobileMenuOpen ? <FaTimes /> : <FaBars />}
      </button>

      <aside className={`dash-sidebar ${isMobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-logo">
          <h2>ADMIN PANEL</h2>
          <span>Senior Control v2.5</span>
        </div>
        <nav className="sidebar-menu">
          <button className={`menu-item ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => { setActiveTab("dashboard"); setIsMobileMenuOpen(false); }}>
            <FaCogs className="icon" /> Dashboard / Asosiy
          </button>
          <button className={`menu-item ${activeTab === "ustalar" ? "active" : ""}`} onClick={() => { setActiveTab("ustalar"); setIsMobileMenuOpen(false); }}>
            <FaTools className="icon" /> Ustalar Bazasi ({mastersList.length})
          </button>
          <button className={`menu-item ${activeTab === "random" ? "active" : ""}`} onClick={() => { setActiveTab("random"); setIsMobileMenuOpen(false); }}>
            <FaRandom className="icon" /> Kod Generator ({allPromoCodes.length})
          </button>
          <button className={`menu-item ${activeTab === "bonuslar" ? "active" : ""}`} onClick={() => { setActiveTab("bonuslar"); setIsMobileMenuOpen(false); }}>
            <FaGift className="icon" /> Aksiya Muddatlari
          </button>
        </nav>
        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <FaSignOutAlt className="icon" /> Chiqish
          </button>
        </div>
      </aside>

      <main className="dash-main">
        <header className="dash-header">
          <div className="welcome-text">
            Tizim: {loading ? <span style={{color: "var(--warning)"}}>Yuklanmoqda...</span> : <span style={{color: "var(--success)"}}>Sinxronlashdi ✅</span>}
          </div>
          <div className="user-profile"><span className="role-badge">SUPER ADMIN</span></div>
        </header>

        <section className="dash-content">
          
          {activeTab === "dashboard" && (
            <div className="tab-section fade-in">
              <h3>Dashboard Tahlillari</h3>
              
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-card-header"><h4>Umumiy Ustalar</h4><FaUsers className="card-icon blue" /></div>
                  <p className="stat-number">{stats.totalUsers} ta</p>
                </div>
                <div className="stat-card">
                  <div className="stat-card-header"><h4>Kutilayotgan Bonuslar</h4><FaUserClock className="card-icon orange" /></div>
                  <p className="stat-number" style={{color: "var(--warning)"}}>{stats.pendingBonus} ariza</p>
                </div>
              </div>

              <div className="chart-section">
                <h4>📊 Top Ustalar Ballari Diagrammasi</h4>
                <div style={{ width: "100%", height: 350 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topMasters}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                      <XAxis dataKey="name" stroke="#475569" />
                      <YAxis stroke="#475569" />
                      <Tooltip />
                      <Bar dataKey="ball" fill="#3b82f6" radius={[8, 8, 0, 0]} maxBarSize={60} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="history-section">
                <h4>Kiritilgan kodlarni tasdiqlash paneli</h4>
                <div className="stats-grid" style={{marginTop: "20px", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))"}}>
                  {pendingRequests.length === 0 ? (
                    <p style={{color: "var(--text-muted)"}}>Kutilayotgan yangi arizalar yo'q.</p>
                  ) : (
                    pendingRequests.map((req) => (
                      <div key={req.id} className="stat-card">
                        <h5>{req.profiles?.full_name || "Noma'lum Usta"}</h5>
                        <p>Tel: {req.profiles?.phone}</p>
                        <p>Joriy balli: <b>{req.profiles?.bonus || 0} ball</b></p>
                        <p style={{margin: "10px 0 20px 0"}}>
                          Kod: <span style={{background: "#f1f5f9", padding: "6px 12px", borderRadius: "6px", fontWeight:"700"}}>{req.promo_codes?.code}</span>
                        </p>
                        <button 
                          className="send-code-btn" 
                          style={{width: "100%", background: "var(--success)", justifyContent: "center"}}
                          onClick={() => handleApproveBonus(req.id, req.user_id, req.profiles?.bonus || 0)}
                        >
                          <FaCheckCircle /> Ball Qo'shish (+1)
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "ustalar" && (
            <div className="tab-section fade-in">
              <h3>Barcha ro'yxatdan o'tgan ustalar va ularning joriy ballari</h3>
              <div className="custom-table-wrapper" style={{marginTop: "20px"}}>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Ism Familiya</th>
                      <th>Telefon</th>
                      <th>Hudud</th>
                      <th style={{textAlign: "right"}}>To'plangan Ball</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mastersList.map((master) => (
                      <tr key={master.id}>
                        <td style={{fontWeight: "600"}}>{master.full_name || "Kiritilmagan"}</td>
                        <td>{master.phone}</td>
                        <td>{master.region || "Ko'rsatilmagan"}</td>
                        <td style={{textAlign: "right", fontWeight: "800", color: "var(--success)"}}>{master.bonus || 0} ball</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "random" && (
            <div className="tab-section fade-in">
              <h3>Unikal Kodlar Boshqaruvi (O'chib ketmaydigan Arxiv)</h3>
              <div className="code-box" style={{marginTop: "20px"}}>
                <div style={{display: "flex", gap: "20px", alignItems: "center", marginTop: "20px", flexWrap: "wrap", marginBottom: "30px"}}>
                  <input 
                    type="number" 
                    placeholder="Miqdor (Masalan: 100)" 
                    value={codeQuantity}
                    onChange={(e) => setCodeQuantity(e.target.value)}
                    className="code-input"
                    style={{maxWidth: "340px"}}
                    disabled={loading}
                  />
                  <button className="send-code-btn" onClick={handleGenerateCodes} disabled={loading}>
                    {loading ? "Yozilmoqda..." : <><FaRandom /> Generatsiya va Bazaga saqlash</> }
                  </button>
                </div>

                {allPromoCodes.length > 0 && (
                  <div style={{borderTop: "2px dashed var(--border-color)", paddingTop: "30px"}}>
                    <div style={{display: "flex", justifyContent: "between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "15px"}}>
                      <div style={{display: "flex", alignItems: "center", gap: "10px", color: "var(--text-muted)", fontSize: "16px"}}>
                        <FaCalendarAlt color="var(--primary)" />
                        <span>Oxirgi faollik vaqti: <strong>{generationDate}</strong></span>
                      </div>
                      <span style={{fontWeight: "600"}}>Jami arxivda: {allPromoCodes.length} ta kod mavjud</span>
                    </div>

                    <div className="custom-table-wrapper" style={{maxHeight: "400px", overflowY: "auto", marginBottom: "24px"}}>
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th style={{width: "80px"}}>#</th>
                            <th>Kod</th>
                            <th>Holat</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allPromoCodes.map((code, index) => (
                            <tr key={code.id}>
                              <td>{index + 1}</td>
                              <td style={{fontWeight: "700", fontFamily: "monospace", fontSize: "18px", color: "var(--primary)"}}>{code.code}</td>
                              <td>
                                {code.is_active ? (
                                  <span style={{color: "var(--success)", background: "rgba(16, 185, 129, 0.1)", padding: "4px 10px", borderRadius: "6px"}}>Faol (Ishlatish mumkin)</span>
                                ) : (
                                  <span style={{color: "var(--text-muted)", background: "#f1f5f9", padding: "4px 10px", borderRadius: "6px"}}>Ishlatilgan / Band</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={{display: "flex", justifyContent: "flex-end"}}>
                      <button className="send-code-btn" onClick={exportToPDF} style={{background: "var(--danger)", padding: "16px 40px"}}>
                        <FaFilePdf /> Barcha Kodlarni PDF yuklash
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </section>
      </main>
    </div>
  );
}