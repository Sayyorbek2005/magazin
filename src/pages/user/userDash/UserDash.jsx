import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

// 🌟 Ikonkalarni import qilish
import { 
  FaChartBar, 
  FaKey, 
  FaCogs, 
  FaSignOutAlt, 
  FaUserCircle, 
  FaBars, 
  FaTimes, 
  FaHistory 
} from "react-icons/fa";

// 🌟 Grafik (Chart) uchun Recharts import qilish
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from "recharts";

import "./userDash.css";

const initialChartData = [
  { name: "Dush", bonus: 0 },
  { name: "Sesh", bonus: 0 },
  { name: "Chor", bonus: 0 },
  { name: "Pay", bonus: 0 },
  { name: "Jum", bonus: 0 },
  { name: "Shan", bonus: 0 },
  { name: "Yak", bonus: 0 },
];

export default function UserDash() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("home");
  const [bonusCode, setBonusCode] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [currentBonus, setCurrentBonus] = useState(0);
  const [codeCount, setCodeCount] = useState(0);
  const [dynamicChartData, setDynamicChartData] = useState(initialChartData);

  const navigate = useNavigate();

  // 👤 1. Sahifa yuklanganda xotiradagi bor ma'lumotni o'qish
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const user = JSON.parse(storedUser);
      setCurrentUser(user);

      const savedBonus = localStorage.getItem(`bonus_${user.phone}`);
      const savedCount = localStorage.getItem(`count_${user.phone}`);
      const savedChart = localStorage.getItem(`chart_${user.phone}`);

      if (savedBonus) setCurrentBonus(parseInt(savedBonus));
      if (savedCount) setCodeCount(parseInt(savedCount));
      if (savedChart) setDynamicChartData(JSON.parse(savedChart));
    } else {
      navigate("/login");
    }
  }, []);

  // 💾 2. Qiymatlar o'zgarganda ularni LocalStorage-ga yozish
  useEffect(() => {
    if (currentUser?.phone) {
      localStorage.setItem(`bonus_${currentUser.phone}`, currentBonus);
    }
  }, [currentBonus, currentUser]);

  useEffect(() => {
    if (currentUser?.phone) {
      localStorage.setItem(`count_${currentUser.phone}`, codeCount);
    }
  }, [codeCount, currentUser]);

  useEffect(() => {
    if (currentUser?.phone) {
      localStorage.setItem(`chart_${currentUser.phone}`, JSON.stringify(dynamicChartData));
    }
  }, [dynamicChartData, currentUser]);


  const handleLogout = () => {
    localStorage.removeItem("user");
    toast.info("Tizimdan chiqdingiz");
    navigate("/login");
  };

  const handleSendCode = () => {
    if (!bonusCode) {
      toast.error("Iltimos, kodni kiriting!");
      return;
    }
    
    if (bonusCode.trim().toLowerCase() === "xato") { 
      toast.error("Kod xato yoki oldin kiritilgan!");
    } else {
      // 🎯 HAR BIR KOD KIRITILGANDA CHINAKAMIGA 1 BALL QO'SHILADI
      const bonusAmount = 1; 

      setCurrentBonus((prev) => prev + bonusAmount); 
      setCodeCount((prev) => prev + 1);

      setDynamicChartData((prevData) => {
        return prevData.map((item) => {
          if (item.name === "Yak") {
            return { ...item, bonus: item.bonus + bonusAmount };
          }
          return item;
        });
      });

      toast.success("Kod muvaffaqiyatli yuborildi va saqlandi!");
      setBonusCode("");
      setActiveTab("home");
    }
  };

  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="dash-container">
      <button className="mobile-menu-toggle" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
        {isMobileMenuOpen ? <FaTimes /> : <FaBars />}
      </button>

      <aside className={`dash-sidebar ${isMobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-logo"></div>
        <nav className="sidebar-menu">
          <button className={`menu-item ${activeTab === "home" ? "active" : ""}`} onClick={() => handleTabChange("home")}>
            <FaChartBar className="icon" /> Home / Statistika
          </button>
          <button className={`menu-item ${activeTab === "code" ? "active" : ""}`} onClick={() => handleTabChange("code")}>
            <FaKey className="icon" /> Kodni kiritish
          </button>
          <button className={`menu-item ${activeTab === "settings" ? "active" : ""}`} onClick={() => handleTabChange("settings")}>
            <FaCogs className="icon" /> Sozlamalar
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
            Usta: <span className="user-name-span">{currentUser?.full_name}</span>
          </div>
          <div className="user-profile">
            <span className="role-badge">{currentUser?.role}</span>
            <FaUserCircle className="profile-avatar-icon" />
          </div>
        </header>

        <section className="dash-content">
          {activeTab === "home" && (
            <div className="tab-section fade-in">
              <h3>Statistika</h3>
              <br />
              <div className="stats-grid">
                <div className="stat-card">
                  <h4>Yig`ilgan ballar</h4>
                  {/* .toLocaleString() raqamlarni chiroyli formatlaydi */}
                  <p className="stat-number">{currentBonus.toLocaleString()} ball</p> 
                </div>
                <div className="stat-card">
                  <h4>Kiritilgan kodlar</h4>
                  <p className="stat-number">{codeCount} ta</p>
                </div>
              </div>

              <div className="chart-section">
                <h4>Haftalik bonuslar grafigi</h4>
                <div style={{ width: "100%", height: 250 }}>
                  <ResponsiveContainer>
                    <AreaChart data={dynamicChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorBonus" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#eab308" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                      <XAxis dataKey="name" stroke="#64748b" fontSize={12}/>
                      <YAxis stroke="#64748b" fontSize={12}/>
                      <Tooltip />
                      <Area type="monotone" dataKey="bonus" stroke="#eab308" strokeWidth={2} fillOpacity={1} fill="url(#colorBonus)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="history-section">
                <button className="action-btn" onClick={() => toast.info("Tarix tez kunda ochiladi...")}>
                  <FaHistory className="icon-inline" /> Bonuslar tarixini ko‘rish
                </button>
              </div>
            </div>
          )}

          {activeTab === "code" && (
            <div className="tab-section fade-in">
              <h3>Kodni kiritish</h3>
              <br />
              <div className="code-box">
                <p>Kodni quyidagi maydonga kiriting:</p>
                <br />
                <input 
                  type="text" 
                  placeholder="Masalan: B78X99" 
                  value={bonusCode}
                  onChange={(e) => setBonusCode(e.target.value)}
                  className="code-input"
                />
                <button className="send-code-btn" onClick={handleSendCode}>Kodni tasdiqlash</button>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="tab-section fade-in">
              <h3>Sozlamalar</h3>
              <br />
              <div className="settings-list">
                <div className="settings-card">
                  <h4>Usta ma'lumotlari</h4>
                  <p><b>Ism:</b> {currentUser?.full_name}</p>
                  <p><b>Telefon:</b> {currentUser?.phone}</p>
                  <p><b>Viloyat:</b> {currentUser?.region}</p>
                </div>
                
                <div className="settings-actions">
                  <button className="settings-btn" onClick={() => toast.warn("Tez kunda...")}>
                    🔄 Loginni o‘zgartirish
                  </button>
                  <button className="settings-btn logout-danger" onClick={handleLogout}>
                    ❌ Tizimdan chiqish
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}