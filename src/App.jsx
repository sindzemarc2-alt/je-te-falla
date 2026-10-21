import React, { useState, useEffect } from 'react';
import { 
  Search, PlusCircle, MapPin, Phone, MessageSquare, 
  AlertTriangle, Package, Users, X, Loader, Share2, 
  Sparkles, SlidersHorizontal, ShieldCheck, Moon, Sun, ArrowUpDown, Send, MessageCircle, UploadCloud, CheckCircle, Calendar, Plus, Eye
} from 'lucide-react';
import { 
  ajouterAnnonce, 
  ecouterAnnonces, 
  marquerCommeRetrouve,
  ajouterCommentaire, 
  ecouterCommentaires 
} from './firebase';

import logoImg from './assets/logo.png';

const VILLES_CAMEROUN = [
  "Toutes les villes", "Douala", "Yaoundé", "Bafoussam", "Garoua", 
  "Bamenda", "Maroua", "Kribi", "Buea", "Ngaoundéré", "Limbé", "Dschang", "Ebolowa", "Bertoua"
];

const CATEGORIES_OBJETS = [
  "Toutes", "Pièce d'identité (CNI)", "Passeport", "Permis de conduire", 
  "Carte grise / Papiers", "Téléphone / Électronique", "Sac / Effets", "Diplômes / Papiers"
];

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('recherche');
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVille, setSelectedVille] = useState('Toutes les villes');
  const [selectedCategory, setSelectedCategory] = useState('Toutes');
  const [selectedDateFilter, setSelectedDateFilter] = useState('toutes');
  const [showOnlyUrgent, setShowOnlyUrgent] = useState(false);
  const [sortBy, setSortBy] = useState('recents');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCommentsPost, setActiveCommentsPost] = useState(null);
  const [resolvePostTarget, setResolvePostTarget] = useState(null);
  const [selectedPostDetail, setSelectedPostDetail] = useState(null); // NOUVEAU : Pour voir les détails complets d'une annonce
  const [pinInput, setPinInput] = useState('');

  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState('');
  const [imagePreview, setImagePreview] = useState(null);

  const [newPost, setNewPost] = useState({
    type: 'recherche',
    category: 'Personne disparue',
    title: '',
    description: '',
    ville: 'Douala',
    quartier: '',
    status: 'Actif',
    urgent: false,
    contactName: '',
    phone: '',
    whatsapp: '',
    reward: '',
    photoUrl: '',
    pinCode: ''
  });

  useEffect(() => {
    setLoading(true);
    const unsubPosts = ecouterAnnonces((data) => {
      setPosts(data);
      setLoading(false);
    });

    const unsubComments = ecouterCommentaires((data) => {
      setComments(data);
    });

    return () => {
      unsubPosts();
      unsubComments();
    };
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("La photo est trop lourde (max 2 Mo).");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setNewPost(prev => ({ ...prev, photoUrl: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const getFilteredAndSortedPosts = () => {
    let result = posts.filter(post => {
      if (post.resolved === true) return false;
      if (post.type !== activeTab) return false;
      if (selectedVille !== 'Toutes les villes' && post.ville !== selectedVille) return false;
      if (activeTab === 'objet' && selectedCategory !== 'Toutes' && post.category !== selectedCategory) return false;
      if (showOnlyUrgent && !post.urgent) return false;

      if (selectedDateFilter !== 'toutes') {
        const postDateMillis = post.createdAt?.seconds ? post.createdAt.seconds * 1000 : Date.now();
        const now = Date.now();
        const diffDays = (now - postDateMillis) / (1000 * 60 * 60 * 24);

        if (selectedDateFilter === 'aujourdhui' && diffDays > 1) return false;
        if (selectedDateFilter === '7jours' && diffDays > 7) return false;
        if (selectedDateFilter === '30jours' && diffDays > 30) return false;
      }

      const query = searchQuery.toLowerCase();
      return (
        (post.title && post.title.toLowerCase().includes(query)) ||
        (post.description && post.description.toLowerCase().includes(query)) ||
        (post.quartier && post.quartier.toLowerCase().includes(query)) ||
        (post.category && post.category.toLowerCase().includes(query))
      );
    });

    return result.sort((a, b) => {
      const dateA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : Date.now();
      const dateB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : Date.now();

      if (sortBy === 'urgents') {
        if (a.urgent && !b.urgent) return -1;
        if (!a.urgent && b.urgent) return 1;
        return dateB - dateA;
      } else if (sortBy === 'anciens') {
        return dateA - dateB;
      } else {
        return dateB - dateA;
      }
    });
  };

  const filteredPosts = getFilteredAndSortedPosts();

  const handleSubmitNewPost = async (e) => {
    e.preventDefault();
    if (!newPost.title || !newPost.phone || !newPost.pinCode) {
      alert("Veuillez remplir le titre, le téléphone et un code PIN secret !");
      return;
    }

    setSubmitting(true);

    const postData = {
      ...newPost,
      type: activeTab,
      photo: newPost.photoUrl || null,
      phone: newPost.phone.startsWith('+') ? newPost.phone : `+237${newPost.phone.replace(/\s+/g, '')}`,
      whatsapp: newPost.whatsapp ? newPost.whatsapp.replace(/[^0-9]/g, '') : newPost.phone.replace(/[^0-9]/g, ''),
      date: new Date().toLocaleDateString('fr-FR')
    };

    const res = await ajouterAnnonce(postData);
    setSubmitting(false);

    if (res.success) {
      setIsModalOpen(false);
      setImagePreview(null);
      triggerNotification("Annonce publiée ! Conservez bien votre code PIN pour la retirer.");
      setNewPost({
        type: activeTab,
        category: activeTab === 'recherche' ? 'Personne disparue' : 'Pièce d\'identité (CNI)',
        title: '',
        description: '',
        ville: 'Douala',
        quartier: '',
        status: activeTab === 'recherche' ? 'Actif' : 'Perdu',
        urgent: false,
        contactName: '',
        phone: '',
        whatsapp: '',
        reward: '',
        photoUrl: '',
        pinCode: ''
      });
    } else {
      alert("Erreur lors de l'enregistrement de l'annonce.");
    }
  };

  const handleConfirmResolve = async (e) => {
    e.preventDefault();
    if (!pinInput) return;

    const res = await marquerCommeRetrouve(resolvePostTarget.id, pinInput, resolvePostTarget.pinCode);
    if (res.success) {
      setResolvePostTarget(null);
      setPinInput('');
      triggerNotification("Annonce clôturée et retirée du public avec succès !");
    } else {
      alert(res.error || "Code PIN incorrect !");
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setSendingComment(true);
    const res = await ajouterCommentaire(
      activeCommentsPost.id, 
      commentAuthor.trim() || "Citoyen", 
      commentText.trim()
    );
    setSendingComment(false);

    if (res.success) {
      setCommentText('');
      triggerNotification("Commentaire ajouté !");
    }
  };

  const triggerNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 4000);
  };

  const shareAnnonce = (post) => {
    const text = `📢 *JE TE FALLA (Cameroun)*\n\n*${post.title}*\n📍 Localisation : ${post.ville} (${post.quartier})\n📞 Contact : ${post.phone}\n\nRetrouvez cette annonce sur l'application Je Te Falla !`;
    if (navigator.share) {
      navigator.share({ title: post.title, text: text, url: window.location.href });
    } else {
      navigator.clipboard.writeText(text);
      triggerNotification("Lien de l'annonce copié !");
    }
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 pb-24 md:pb-12 relative overflow-hidden ${
      darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
    }`}>
      
      {/* FILIGRANE */}
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden">
        <img 
          src={logoImg} 
          alt="Filigrane Je Te Falla" 
          className={`w-[90vw] max-w-3xl object-contain transition-all duration-500 ${
            darkMode 
              ? 'opacity-15 filter invert brightness-125 saturate-150' 
              : 'opacity-10 mix-blend-multiply'
          }`}
        />
      </div>

      {notification && (
        <div className="fixed top-4 right-4 left-4 md:left-auto md:w-96 bg-emerald-900 text-white p-4 rounded-2xl shadow-2xl z-50 flex items-center justify-between border-2 border-yellow-400 animate-bounce">
          <div className="flex items-center space-x-2">
            <Sparkles size={20} className="text-yellow-400 shrink-0" />
            <span className="text-xs font-bold">{notification}</span>
          </div>
          <button onClick={() => setNotification('')}><X size={16} /></button>
        </div>
      )}

      {/* HEADER */}
      <header className={`shadow-xl sticky top-0 z-40 transition-colors ${
        darkMode ? 'bg-slate-900/95 border-b border-slate-800' : 'bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white'
      } backdrop-blur-md`}>
        <div className="max-w-6xl mx-auto px-3 py-2 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className={`p-1 rounded-xl transition-all shadow-lg ${
              darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white/95'
            }`}>
              <img 
                src={logoImg} 
                alt="Logo Je Te Falla" 
                className="h-12 sm:h-16 w-auto object-contain rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-xl border transition-all flex items-center justify-center ${
                darkMode ? 'bg-slate-800 border-slate-700 text-yellow-400' : 'bg-emerald-950/60 border-emerald-700/60 text-yellow-300'
              }`}
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button 
              onClick={() => {
                setNewPost(prev => ({ 
                  ...prev, 
                  type: activeTab,
                  category: activeTab === 'recherche' ? 'Personne disparue' : 'Pièce d\'identité (CNI)'
                }));
                setImagePreview(null);
                setIsModalOpen(true);
              }}
              className="bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 text-emerald-950 font-extrabold px-3 py-2 rounded-xl shadow-lg transition-all flex items-center space-x-1 text-[11px] sm:text-xs uppercase tracking-wider shrink-0"
            >
              <PlusCircle size={16} />
              <span>Publier</span>
            </button>
          </div>
        </div>

        <div className={`${darkMode ? 'bg-slate-950/90 border-t border-slate-800' : 'bg-emerald-950/80 border-t border-emerald-700/50'} backdrop-blur`}>
          <div className="max-w-6xl mx-auto px-2 flex">
            <button
              onClick={() => { setActiveTab('recherche'); setSelectedCategory('Toutes'); }}
              className={`flex-1 py-3 px-1 font-black text-center transition-all flex items-center justify-center space-x-1.5 border-b-4 ${
                activeTab === 'recherche' ? 'border-yellow-400 text-yellow-300 bg-emerald-900/60' : 'border-transparent text-emerald-200/80'
              }`}
            >
              <Users size={16} className={activeTab === 'recherche' ? 'text-yellow-400' : ''} />
              <span className="text-[11px] sm:text-sm uppercase tracking-wider">📢 Recherche</span>
            </button>

            <button
              onClick={() => { setActiveTab('objet'); setSelectedCategory('Toutes'); }}
              className={`flex-1 py-3 px-1 font-black text-center transition-all flex items-center justify-center space-x-1.5 border-b-4 ${
                activeTab === 'objet' ? 'border-yellow-400 text-yellow-300 bg-emerald-900/60' : 'border-transparent text-emerald-200/80'
              }`}
            >
              <Package size={16} className={activeTab === 'objet' ? 'text-yellow-400' : ''} />
              <span className="text-[11px] sm:text-sm uppercase tracking-wider">🔍 Objets Perdus</span>
            </button>
          </div>
        </div>
      </header>

      {/* BOUTON FLOTTANT EN BAS À DROITE */}
      <button
        onClick={() => {
          setNewPost(prev => ({ 
            ...prev, 
            type: activeTab,
            category: activeTab === 'recherche' ? 'Personne disparue' : 'Pièce d\'identité (CNI)'
          }));
          setImagePreview(null);
          setIsModalOpen(true);
        }}
        className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-yellow-400 to-amber-500 text-emerald-950 p-4 rounded-full shadow-2xl flex items-center justify-center border-4 border-white dark:border-slate-900 animate-bounce hover:scale-110 transition-transform"
        title="Publier une annonce"
      >
        <Plus size={28} className="stroke-[3]" />
      </button>

      {/* BANNIÈRE */}
      <section className={`py-6 relative overflow-hidden shadow-lg border-b-4 border-yellow-400 z-10 ${
        darkMode ? 'bg-slate-900/90 text-slate-100' : 'bg-emerald-900/95 text-white'
      }`}>
        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-1.5 bg-red-600/30 border border-red-500/40 text-red-200 text-xs px-3 py-1 rounded-full font-bold mb-2">
                <ShieldCheck size={14} className="text-red-400" />
                <span>Plateforme Citoyenne Nationale</span>
              </div>
              <h2 className="text-xl sm:text-3xl font-black tracking-tight">
                {activeTab === 'recherche' 
                  ? 'Aidez à retrouver un proche ou un disparu' 
                  : 'Retrouvez vos CNI, Passeports et Effets perdus'}
              </h2>
            </div>

            <div className="flex items-center gap-3 bg-slate-950/50 p-3 rounded-2xl border border-slate-700/50 self-start md:self-auto">
              <div className="text-center px-3 border-r border-slate-700/50">
                <span className="block text-xl font-black text-yellow-400">{filteredPosts.length}</span>
                <span className="text-[10px] text-slate-300 font-medium uppercase">En cours</span>
              </div>
              <div className="text-center px-3">
                <span className="block text-xl font-black text-emerald-400">{posts.filter(p => p.resolved).length}</span>
                <span className="text-[10px] text-slate-300 font-medium uppercase">Retrouvés</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RECHERCHE ET FILTRES */}
      <div className="max-w-6xl mx-auto px-4 -mt-5 relative z-20">
        <div className={`rounded-3xl shadow-xl p-4 border transition-colors ${
          darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/95 border-slate-200/80'
        } space-y-3 backdrop-blur-md`}>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
              <input
                type="text"
                placeholder={activeTab === 'recherche' ? "Rechercher par nom, quartier..." : "Rechercher par nom sur CNI, objet..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-600 text-xs sm:text-sm font-medium ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>

            <div className="w-full md:w-48 relative">
              <MapPin className="absolute left-3.5 top-3.5 text-emerald-500" size={18} />
              <select
                value={selectedVille}
                onChange={(e) => setSelectedVille(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-600 text-xs sm:text-sm font-bold appearance-none cursor-pointer ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                {VILLES_CAMEROUN.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div className="w-full md:w-52 relative">
              <Calendar className="absolute left-3.5 top-3.5 text-blue-400" size={18} />
              <select
                value={selectedDateFilter}
                onChange={(e) => setSelectedDateFilter(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm font-bold appearance-none cursor-pointer ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <option value="toutes">📅 Toutes les dates</option>
                <option value="aujourdhui">⚡ Aujourd'hui</option>
                <option value="7jours">📆 Ces 7 derniers jours</option>
                <option value="30jours">🗓️ Ces 30 derniers jours</option>
              </select>
            </div>

            <div className="w-full md:w-52 relative">
              <ArrowUpDown className="absolute left-3.5 top-3.5 text-yellow-500" size={18} />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-500 text-xs sm:text-sm font-bold appearance-none cursor-pointer ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-yellow-400' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <option value="recents">🕒 Plus récentes d'abord</option>
                <option value="urgents">⚠️ Urgences d'abord</option>
                <option value="anciens">⏳ Plus anciennes d'abord</option>
              </select>
            </div>

            <button
              onClick={() => setShowOnlyUrgent(!showOnlyUrgent)}
              className={`px-4 py-3 rounded-2xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all border shrink-0 ${
                showOnlyUrgent ? 'bg-red-600 text-white border-red-600' : darkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              <AlertTriangle size={15} />
              <span>URGENTS</span>
            </button>
          </div>

          {activeTab === 'objet' && (
            <div className="flex items-center gap-2 overflow-x-auto pt-2 pb-1 scrollbar-none">
              <span className="text-[11px] font-black text-slate-400 uppercase shrink-0 flex items-center gap-1">
                <SlidersHorizontal size={12} /> Catégorie :
              </span>
              {CATEGORIES_OBJETS.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                    selectedCategory === cat ? 'bg-emerald-800 text-yellow-300' : darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* LISTE DES ANNONCES */}
      <main className="max-w-6xl mx-auto px-4 mt-8 relative z-10">
        <div className="flex justify-between items-center mb-6">
          <h3 className={`text-base font-extrabold flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
            <span>Annonces actives</span>
            <span className="bg-yellow-400 text-emerald-950 text-xs px-3 py-0.5 rounded-full font-black">
              {filteredPosts.length}
            </span>
          </h3>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-emerald-600">
            <Loader className="animate-spin mb-3" size={40} />
            <p className="text-xs font-extrabold uppercase">Chargement Je Te Falla...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className={`rounded-3xl p-12 text-center border-2 border-dashed ${
            darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-300'
          }`}>
            <AlertTriangle className="mx-auto text-amber-500 mb-3" size={48} />
            <h4 className="text-lg font-bold">Aucune annonce active trouvée</h4>
            <p className="text-xs text-slate-400 mt-2">Cliquez sur le bouton ➕ en bas à droite pour publier la première !</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post) => {
              const postComments = comments.filter(c => c.postId === post.id);

              return (
                <div 
                  key={post.id} 
                  className={`rounded-3xl overflow-hidden border transition-all duration-300 flex flex-col group relative ${
                    darkMode ? 'bg-slate-900/90 border-slate-800 shadow-lg' : 'bg-white/90 border-slate-200/80 shadow-sm hover:shadow-xl'
                  } backdrop-blur-sm`}
                >
                  {post.reward && (
                    <div className="absolute top-3 right-3 z-10 bg-yellow-400 text-emerald-950 font-black text-[11px] px-3 py-1 rounded-xl shadow-lg border border-yellow-500 animate-pulse">
                      💰 Récompense : {post.reward}
                    </div>
                  )}

                  {/* PHOTO CLIQUABLE POUR VOIR LES DÉTAILS */}
                  {post.photo && (
                    <div 
                      onClick={() => setSelectedPostDetail(post)}
                      className="relative h-56 bg-slate-900 flex items-center justify-center overflow-hidden border-b border-slate-800 cursor-pointer"
                    >
                      <img 
                        src={post.photo} 
                        alt={post.title} 
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
                        {post.urgent && (
                          <span className="bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow uppercase">
                            URGENT
                          </span>
                        )}
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg shadow uppercase ${
                          post.status === 'Trouvé' ? 'bg-emerald-600 text-white' :
                          post.status === 'Perdu' ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'
                        }`}>
                          {post.status}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      {!post.photo && (
                        <div className="flex items-center gap-1.5 mb-2">
                          {post.urgent && (
                            <span className="bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow uppercase">
                              URGENT
                            </span>
                          )}
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg shadow uppercase ${
                            post.status === 'Trouvé' ? 'bg-emerald-600 text-white' :
                            post.status === 'Perdu' ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'
                          }`}>
                            {post.status}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded-md ${
                          darkMode ? 'bg-slate-800 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {post.category}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">{post.date}</span>
                      </div>

                      {/* TITRE CLIQUABLE POUR VOIR LES DÉTAILS */}
                      <h4 
                        onClick={() => setSelectedPostDetail(post)}
                        className="font-extrabold text-base line-clamp-1 mb-2 cursor-pointer hover:text-emerald-500 transition-colors"
                      >
                        {post.title}
                      </h4>

                      <p 
                        onClick={() => setSelectedPostDetail(post)}
                        className={`text-xs line-clamp-3 mb-3 leading-relaxed p-2.5 rounded-xl border cursor-pointer ${
                          darkMode ? 'bg-slate-800/50 border-slate-800 text-slate-300 hover:border-slate-600' : 'bg-slate-50/50 border-slate-100 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {post.description || "Aucune description détaillée fournie."}
                      </p>
                    </div>

                    <div>
                      <div className={`flex items-center text-xs mb-3 p-2.5 rounded-xl border ${
                        darkMode ? 'bg-slate-800/80 border-slate-800 text-slate-300' : 'bg-emerald-50/50 border-emerald-100/60 text-slate-700'
                      }`}>
                        <MapPin size={15} className="text-emerald-500 mr-1.5 shrink-0" />
                        <span className="font-black mr-1">{post.ville}</span>
                        {post.quartier && <span className="text-slate-400 truncate">({post.quartier})</span>}
                      </div>

                      {/* BOUTON VOIR LES DÉTAILS */}
                      <button
                        onClick={() => setSelectedPostDetail(post)}
                        className="w-full mb-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-black flex items-center justify-center space-x-1 shadow transition-all"
                      >
                        <Eye size={14} />
                        <span>Voir tous les détails</span>
                      </button>

                      <div className={`grid grid-cols-4 gap-1.5 pt-2 border-t ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                        <a 
                          href={`https://wa.me/${post.whatsapp}?text=Bonjour,%20je%20vous%20contacte%20depuis%20Je%20Te%20Falla%20au%20sujet%20de%20:%20${encodeURIComponent(post.title)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="col-span-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-1 rounded-xl text-xs flex items-center justify-center space-x-1"
                        >
                          <MessageSquare size={13} />
                          <span className="hidden sm:inline">WA</span>
                        </a>

                        <a 
                          href={`tel:${post.phone}`}
                          className={`col-span-1 font-bold py-2 px-1 rounded-xl text-xs flex items-center justify-center space-x-1 ${
                            darkMode ? 'bg-slate-800 text-slate-100' : 'bg-slate-800 text-white'
                          }`}
                        >
                          <Phone size={13} />
                          <span className="hidden sm:inline">Appel</span>
                        </a>

                        <button 
                          onClick={() => setActiveCommentsPost(post)}
                          className={`col-span-1 font-bold py-2 px-1 rounded-xl text-xs flex items-center justify-center space-x-1 relative ${
                            darkMode ? 'bg-slate-800 text-yellow-400' : 'bg-yellow-100 text-emerald-950'
                          }`}
                        >
                          <MessageCircle size={13} />
                          <span>{postComments.length}</span>
                        </button>

                        <button 
                          onClick={() => shareAnnonce(post)}
                          className={`col-span-1 font-bold py-2 px-1 rounded-xl text-xs flex items-center justify-center space-x-1 ${
                            darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          <Share2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* NOUVELLE MODALE : VOIR TOUS LES DÉTAILS D'UNE ANNONCE */}
      {selectedPostDetail && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3">
          <div className={`rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border flex flex-col ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-900'
          }`}>
            <div className={`p-4 border-b flex justify-between items-center sticky top-0 z-10 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md ${
                  darkMode ? 'bg-slate-800 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {selectedPostDetail.category}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">{selectedPostDetail.date}</span>
              </div>
              <button onClick={() => setSelectedPostDetail(null)} className="p-1 text-slate-400 hover:text-slate-100">
                <X size={22} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {selectedPostDetail.photo && (
                <div className="relative h-72 bg-black rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800">
                  <img 
                    src={selectedPostDetail.photo} 
                    alt={selectedPostDetail.title} 
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {selectedPostDetail.urgent && (
                  <span className="bg-red-600 text-white text-xs font-black px-3 py-1 rounded-lg uppercase">
                    ⚠️ URGENT
                  </span>
                )}
                <span className={`text-xs font-black px-3 py-1 rounded-lg uppercase ${
                  selectedPostDetail.status === 'Trouvé' ? 'bg-emerald-600 text-white' :
                  selectedPostDetail.status === 'Perdu' ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'
                }`}>
                  {selectedPostDetail.status}
                </span>
                {selectedPostDetail.reward && (
                  <span className="bg-yellow-400 text-emerald-950 font-black text-xs px-3 py-1 rounded-lg">
                    💰 Récompense : {selectedPostDetail.reward}
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-lg font-black mb-2">{selectedPostDetail.title}</h3>
                <div className={`p-3.5 rounded-2xl border text-xs leading-relaxed ${
                  darkMode ? 'bg-slate-800/60 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <p className="font-bold text-slate-400 uppercase text-[10px] mb-1">Description complète :</p>
                  {selectedPostDetail.description || "Aucune description supplémentaire fournie pour cette annonce."}
                </div>
              </div>

              <div className={`p-3.5 rounded-2xl border flex items-center text-xs ${
                darkMode ? 'bg-slate-800/60 border-slate-700 text-slate-300' : 'bg-emerald-50/50 border-emerald-100 text-slate-700'
              }`}>
                <MapPin size={18} className="text-emerald-500 mr-2 shrink-0" />
                <div>
                  <p className="font-bold text-[10px] text-slate-400 uppercase">Localisation</p>
                  <p className="font-black text-sm">{selectedPostDetail.ville} {selectedPostDetail.quartier ? `(${selectedPostDetail.quartier})` : ''}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <a 
                  href={`https://wa.me/${selectedPostDetail.whatsapp}?text=Bonjour,%20je%20vous%20contacte%20depuis%20Je%20Te%20Falla%20au%20sujet%20de%20:%20${encodeURIComponent(selectedPostDetail.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 px-3 rounded-2xl text-xs flex items-center justify-center space-x-2 shadow"
                >
                  <MessageSquare size={16} />
                  <span>Contacter WhatsApp</span>
                </a>

                <a 
                  href={`tel:${selectedPostDetail.phone}`}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-black py-3 px-3 rounded-2xl text-xs flex items-center justify-center space-x-2 shadow border border-slate-700"
                >
                  <Phone size={16} />
                  <span>Appeler ({selectedPostDetail.phone})</span>
                </a>
              </div>

              <button
                onClick={() => {
                  const target = selectedPostDetail;
                  setSelectedPostDetail(null);
                  setResolvePostTarget(target);
                }}
                className="w-full mt-2 bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-500 border border-yellow-400/30 py-2.5 rounded-xl text-xs font-black flex items-center justify-center space-x-1"
              >
                <CheckCircle size={15} />
                <span>C'est retrouvé / Clôturer cette annonce</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE RETROUVÉ */}
      {resolvePostTarget && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3">
          <div className={`rounded-3xl max-w-sm w-full p-5 shadow-2xl border text-center ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-900'
          }`}>
            <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={28} />
            </div>
            <h4 className="font-extrabold text-base mb-1">Retirer cette annonce ?</h4>
            <p className="text-xs text-slate-400 mb-4">
              Entrez le code PIN personnel choisi en publiant : <strong>{resolvePostTarget.title}</strong>
            </p>

            <form onSubmit={handleConfirmResolve} className="space-y-3">
              <input
                type="password"
                required
                maxLength="6"
                placeholder="Votre Code PIN"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className={`w-full p-3 border rounded-2xl text-center font-black text-lg tracking-widest ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200'
                }`}
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setResolvePostTarget(null); setPinInput(''); }}
                  className="flex-1 py-3 bg-slate-200 text-slate-800 font-bold rounded-xl text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-md"
                >
                  Valider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE COMMENTAIRES */}
      {activeCommentsPost && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3">
          <div className={`rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-900'
          }`}>
            <div className={`p-4 border-b flex justify-between items-center ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div>
                <h4 className="font-extrabold text-sm line-clamp-1">{activeCommentsPost.title}</h4>
                <p className="text-[10px] text-slate-400">Pistes et commentaires en direct</p>
              </div>
              <button onClick={() => setActiveCommentsPost(null)} className="p-1 text-slate-400">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {comments.filter(c => c.postId === activeCommentsPost.id).length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Aucun commentaire pour l'instant.
                </div>
              ) : (
                comments.filter(c => c.postId === activeCommentsPost.id).map(c => (
                  <div key={c.id} className={`p-3 rounded-2xl text-xs border ${
                    darkMode ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-100'
                  }`}>
                    <div className="flex justify-between items-center font-bold mb-1 text-emerald-500">
                      <span>👤 {c.auteur}</span>
                      <span className="text-[10px] text-slate-400 font-normal">{c.dateStr}</span>
                    </div>
                    <p className="leading-relaxed">{c.texte}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddComment} className={`p-3 border-t space-y-2 ${
              darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50'
            }`}>
              <input
                type="text"
                placeholder="Votre nom ou quartier"
                value={commentAuthor}
                onChange={(e) => setCommentAuthor(e.target.value)}
                className={`w-full p-2 rounded-xl text-xs border ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                }`}
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Écrivez une information utile..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className={`flex-1 p-2.5 rounded-xl text-xs border ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                  }`}
                />
                <button
                  type="submit"
                  disabled={sendingComment}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 rounded-xl font-bold text-xs flex items-center justify-center shrink-0"
                >
                  {sendingComment ? <Loader className="animate-spin" size={14} /> : <Send size={14} />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE PUBLICATION */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3">
          <div className={`rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-900'
          }`}>
            <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10 dark:bg-slate-900">
              <div className="flex items-center space-x-2">
                <img src={logoImg} alt="Logo" className="h-10 w-auto" />
                <div>
                  <h3 className="font-extrabold text-sm">
                    Publier : {activeTab === 'recherche' ? '📢 Avis de recherche' : '🔍 Objet perdu / trouvé'}
                  </h3>
                  <p className="text-[10px] text-slate-400">JE TE FALLA - Retrouver l'essentiel, ensemble 🇨🇲</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitNewPost} className="p-5 space-y-3.5">
              <div>
                <label className="block text-[11px] font-black uppercase mb-1 text-slate-400">Catégorie</label>
                <select
                  value={newPost.category}
                  onChange={(e) => setNewPost({ ...newPost, category: e.target.value })}
                  className={`w-full p-3 border rounded-2xl text-xs font-bold ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  {activeTab === 'recherche' ? (
                    <>
                      <option value="Personne disparue">Personne disparue</option>
                      <option value="Personne recherchée">Personne recherchée</option>
                      <option value="Alerte urgente">Alerte urgente</option>
                    </>
                  ) : (
                    <>
                      <option value="Pièce d'identité (CNI)">Pièce d'identité (CNI)</option>
                      <option value="Passeport">Passeport</option>
                      <option value="Permis de conduire">Permis de conduire</option>
                      <option value="Carte grise / Papiers véhicule">Carte grise / Papiers véhicule</option>
                      <option value="Téléphone / Électronique">Téléphone / Électronique</option>
                      <option value="Sac / Effets personnels">Sac / Effets personnels</option>
                      <option value="Clés">Clés</option>
                      <option value="Autre">Autre objet</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase mb-1 text-slate-400">Titre *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: CNI au nom de NKOLO Paul"
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                  className={`w-full p-3 border rounded-2xl text-xs ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase mb-1 text-slate-400">Description</label>
                <textarea
                  rows="3"
                  placeholder="Détails supplémentaires..."
                  value={newPost.description}
                  onChange={(e) => setNewPost({ ...newPost, description: e.target.value })}
                  className={`w-full p-3 border rounded-2xl text-xs ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200'
                  }`}
                ></textarea>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase mb-1 text-slate-400">Ajouter une photo (Optionnel)</label>
                <div className={`p-4 border-2 border-dashed rounded-2xl text-center relative cursor-pointer ${
                  darkMode ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50'
                }`}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  {imagePreview ? (
                    <div className="relative inline-block">
                      <img src={imagePreview} alt="Aperçu photo" className="h-28 object-contain rounded-xl shadow border border-emerald-500 bg-black" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-2 text-slate-400">
                      <UploadCloud size={28} className="mb-1 text-emerald-500" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Choisir une photo (Optionnel)</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase mb-1 text-slate-400">Ville</label>
                  <select
                    value={newPost.ville}
                    onChange={(e) => setNewPost({ ...newPost, ville: e.target.value })}
                    className={`w-full p-3 border rounded-2xl text-xs font-bold ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    {VILLES_CAMEROUN.filter(v => v !== "Toutes les villes").map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase mb-1 text-slate-400">Quartier</label>
                  <input
                    type="text"
                    placeholder="ex: Akwa..."
                    value={newPost.quartier}
                    onChange={(e) => setNewPost({ ...newPost, quartier: e.target.value })}
                    className={`w-full p-3 border rounded-2xl text-xs ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase mb-1 text-slate-400">Téléphone *</label>
                  <input
                    type="tel"
                    required
                    placeholder="6XXXXXXXX"
                    value={newPost.phone}
                    onChange={(e) => setNewPost({ ...newPost, phone: e.target.value })}
                    className={`w-full p-3 border rounded-2xl text-xs font-bold ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase mb-1 text-slate-400">Code PIN Secret *</label>
                  <input
                    type="password"
                    required
                    maxLength="6"
                    placeholder="ex: 1234"
                    value={newPost.pinCode}
                    onChange={(e) => setNewPost({ ...newPost, pinCode: e.target.value })}
                    className={`w-full p-3 border rounded-2xl text-xs font-bold ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3.5 rounded-2xl shadow-xl text-xs uppercase tracking-wider flex items-center justify-center space-x-2 mt-4"
              >
                {submitting ? <Loader className="animate-spin" size={16} /> : <span>Publier l'annonce</span>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}