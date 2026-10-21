import React, { useState, useEffect } from 'react';
import { 
  Search, PlusCircle, MapPin, Phone, MessageSquare, 
  AlertTriangle, Package, Users, X, Loader, Share2, 
  ShieldCheck, Moon, Sun, ArrowUpDown, Send, MessageCircle, UploadCloud, CheckCircle, Calendar, Plus, Eye
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
  const [selectedPostDetail, setSelectedPostDetail] = useState(null);
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
      triggerNotification("Annonce publiée avec succès.");
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
      triggerNotification("Annonce clôturée avec succès.");
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
      triggerNotification("Commentaire ajouté.");
    }
  };

  const triggerNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 4000);
  };

  const shareAnnonce = (post) => {
    const text = `JE TE FALLA (Cameroun)\n\n${post.title}\nLocalisation : ${post.ville} (${post.quartier})\nContact : ${post.phone}\n\nConsultez l'annonce sur l'application.`;
    if (navigator.share) {
      navigator.share({ title: post.title, text: text, url: window.location.href });
    } else {
      navigator.clipboard.writeText(text);
      triggerNotification("Lien copié dans le presse-papier.");
    }
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 pb-24 md:pb-12 relative overflow-hidden ${
      darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      
      {/* FILIGRANE DISCRET */}
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden">
        <img 
          src={logoImg} 
          alt="Filigrane" 
          className={`w-[85vw] max-w-2xl object-contain transition-all duration-500 ${
            darkMode ? 'opacity-5 filter invert' : 'opacity-5'
          }`}
        />
      </div>

      {notification && (
        <div className="fixed top-4 right-4 left-4 md:left-auto md:w-96 bg-slate-900 text-white p-4 rounded-2xl shadow-xl z-50 flex items-center justify-between border border-slate-700">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-xs font-medium">{notification}</span>
          </div>
          <button onClick={() => setNotification('')} className="text-slate-400 hover:text-white"><X size={16} /></button>
        </div>
      )}

      {/* HEADER */}
      <header className={`shadow-sm sticky top-0 z-40 transition-colors ${
        darkMode ? 'bg-slate-900/95 border-b border-slate-800' : 'bg-white/95 border-b border-slate-200'
      } backdrop-blur-md`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <img 
                src={logoImg} 
                alt="Logo" 
                className="h-10 w-auto object-contain rounded-lg"
              />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight">JE TE FALLA</h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Plateforme citoyenne 🇨🇲</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-xl border transition-all flex items-center justify-center ${
                darkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl shadow-sm transition-all flex items-center space-x-1.5 text-xs tracking-wide shrink-0"
            >
              <PlusCircle size={16} />
              <span>Publier</span>
            </button>
          </div>
        </div>

        <div className={`${darkMode ? 'bg-slate-900/80 border-t border-slate-800' : 'bg-slate-50 border-t border-slate-200'}`}>
          <div className="max-w-6xl mx-auto px-2 flex">
            <button
              onClick={() => { setActiveTab('recherche'); setSelectedCategory('Toutes'); }}
              className={`flex-1 py-3 px-2 font-semibold text-center transition-all flex items-center justify-center space-x-2 border-b-2 ${
                activeTab === 'recherche' 
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800' 
                  : 'border-transparent text-slate-500 dark:text-slate-400'
              }`}
            >
              <Users size={16} />
              <span className="text-xs uppercase tracking-wider">Avis de recherche</span>
            </button>

            <button
              onClick={() => { setActiveTab('objet'); setSelectedCategory('Toutes'); }}
              className={`flex-1 py-3 px-2 font-semibold text-center transition-all flex items-center justify-center space-x-2 border-b-2 ${
                activeTab === 'objet' 
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800' 
                  : 'border-transparent text-slate-500 dark:text-slate-400'
              }`}
            >
              <Package size={16} />
              <span className="text-xs uppercase tracking-wider">Objets perdus</span>
            </button>
          </div>
        </div>
      </header>

      {/* BOUTON FLOTTANT MOBILE */}
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
        className="fixed bottom-6 right-6 z-40 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105"
        title="Publier une annonce"
      >
        <Plus size={24} className="stroke-[2.5]" />
      </button>

      {/* FILTRES ET RECHERCHE */}
      <div className="max-w-6xl mx-auto px-4 mt-6 relative z-20">
        <div className={`rounded-2xl shadow-sm p-4 border transition-colors ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        } space-y-3`}>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
              <input
                type="text"
                placeholder={activeTab === 'recherche' ? "Rechercher par nom, quartier..." : "Rechercher par nom sur CNI, objet..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 text-xs sm:text-sm ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>

            <div className="w-full md:w-48 relative">
              <MapPin className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
              <select
                value={selectedVille}
                onChange={(e) => setSelectedVille(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 text-xs sm:text-sm font-medium appearance-none cursor-pointer ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                {VILLES_CAMEROUN.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div className="w-full md:w-48 relative">
              <Calendar className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
              <select
                value={selectedDateFilter}
                onChange={(e) => setSelectedDateFilter(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 text-xs sm:text-sm font-medium appearance-none cursor-pointer ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <option value="toutes">Toutes les dates</option>
                <option value="aujourdhui">Aujourd'hui</option>
                <option value="7jours">7 derniers jours</option>
                <option value="30jours">30 derniers jours</option>
              </select>
            </div>

            <div className="w-full md:w-48 relative">
              <ArrowUpDown className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 text-xs sm:text-sm font-medium appearance-none cursor-pointer ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <option value="recents">Plus récents</option>
                <option value="urgents">Urgences d'abord</option>
                <option value="anciens">Plus anciens</option>
              </select>
            </div>

            <button
              onClick={() => setShowOnlyUrgent(!showOnlyUrgent)}
              className={`px-4 py-2.5 rounded-xl font-medium text-xs flex items-center justify-center space-x-1.5 transition-all border shrink-0 ${
                showOnlyUrgent 
                  ? 'bg-rose-600 text-white border-rose-600' 
                  : darkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              <AlertTriangle size={14} />
              <span>Urgents</span>
            </button>
          </div>

          {activeTab === 'objet' && (
            <div className="flex items-center gap-2 overflow-x-auto pt-2 pb-1 scrollbar-none">
              <span className="text-[11px] font-medium text-slate-400 uppercase shrink-0">Catégorie :</span>
              {CATEGORIES_OBJETS.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all ${
                    selectedCategory === cat 
                      ? 'bg-emerald-600 text-white' 
                      : darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
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
      <main className="max-w-6xl mx-auto px-4 mt-6 relative z-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className={`text-sm font-bold flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
            <span>Annonces en cours</span>
            <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs px-2.5 py-0.5 rounded-full font-semibold">
              {filteredPosts.length}
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader className="animate-spin mb-2" size={32} />
            <p className="text-xs font-medium">Chargement des annonces...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className={`rounded-2xl p-12 text-center border border-dashed ${
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
          }`}>
            <p className="text-sm font-medium text-slate-500">Aucune annonce active trouvée.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPosts.map((post) => {
              const postComments = comments.filter(c => c.postId === post.id);

              return (
                <div 
                  key={post.id} 
                  className={`rounded-2xl overflow-hidden border transition-all duration-200 flex flex-col group relative ${
                    darkMode ? 'bg-slate-900 border-slate-800 shadow-sm' : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                  }`}
                >
                  {post.reward && (
                    <div className="absolute top-3 right-3 z-10 bg-amber-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg shadow">
                      Récompense : {post.reward}
                    </div>
                  )}

                  {post.photo && (
                    <div 
                      onClick={() => setSelectedPostDetail(post)}
                      className="relative h-48 bg-slate-900 flex items-center justify-center overflow-hidden border-b border-slate-100 dark:border-slate-800 cursor-pointer"
                    >
                      <img 
                        src={post.photo} 
                        alt={post.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
                        {post.urgent && (
                          <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                            Urgent
                          </span>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          post.status === 'Trouvé' ? 'bg-emerald-600 text-white' :
                          post.status === 'Perdu' ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white'
                        }`}>
                          {post.status}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      {!post.photo && (
                        <div className="flex items-center gap-1.5 mb-2">
                          {post.urgent && (
                            <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                              Urgent
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            post.status === 'Trouvé' ? 'bg-emerald-600 text-white' :
                            post.status === 'Perdu' ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white'
                          }`}>
                            {post.status}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                          {post.category}
                        </span>
                        <span className="text-[10px] text-slate-400">{post.date}</span>
                      </div>

                      <h3 
                        onClick={() => setSelectedPostDetail(post)}
                        className="font-bold text-sm line-clamp-1 mb-1.5 cursor-pointer hover:text-emerald-600 transition-colors"
                      >
                        {post.title}
                      </h3>

                      <p 
                        onClick={() => setSelectedPostDetail(post)}
                        className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-3 cursor-pointer"
                      >
                        {post.description || "Aucune description détaillée."}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center text-xs mb-3 text-slate-500 dark:text-slate-400">
                        <MapPin size={14} className="text-emerald-600 mr-1 shrink-0" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300 mr-1">{post.ville}</span>
                        {post.quartier && <span className="truncate">({post.quartier})</span>}
                      </div>

                      <button
                        onClick={() => setSelectedPostDetail(post)}
                        className="w-full mb-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1 transition-all"
                      >
                        <Eye size={14} />
                        <span>Voir les détails</span>
                      </button>

                      <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <a 
                          href={`https://wa.me/${post.whatsapp}?text=Bonjour,%20je%20vous%20contacte%20depuis%20Je%20Te%20Falla%20au%20sujet%20de%20:%20${encodeURIComponent(post.title)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="col-span-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs flex items-center justify-center"
                          title="WhatsApp"
                        >
                          <MessageSquare size={14} />
                        </a>

                        <a 
                          href={`tel:${post.phone}`}
                          className="col-span-1 bg-slate-800 hover:bg-slate-900 text-white py-2 rounded-xl text-xs flex items-center justify-center dark:bg-slate-700"
                          title="Appeler"
                        >
                          <Phone size={14} />
                        </a>

                        <button 
                          onClick={() => setActiveCommentsPost(post)}
                          className="col-span-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1"
                          title="Commentaires"
                        >
                          <MessageCircle size={14} />
                          <span className="text-[10px]">{postComments.length}</span>
                        </button>

                        <button 
                          onClick={() => shareAnnonce(post)}
                          className="col-span-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-2 rounded-xl text-xs flex items-center justify-center"
                          title="Partager"
                        >
                          <Share2 size={14} />
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

      {/* MODALE DETAILS */}
      {selectedPostDetail && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className={`rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl border flex flex-col ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-inherit z-10">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                  {selectedPostDetail.category}
                </span>
                <span className="text-[10px] text-slate-400">{selectedPostDetail.date}</span>
              </div>
              <button onClick={() => setSelectedPostDetail(null)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {selectedPostDetail.photo && (
                <div className="relative h-64 bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800">
                  <img 
                    src={selectedPostDetail.photo} 
                    alt={selectedPostDetail.title} 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {selectedPostDetail.urgent && (
                  <span className="bg-rose-600 text-white text-xs font-bold px-2.5 py-0.5 rounded uppercase">
                    Urgent
                  </span>
                )}
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded uppercase ${
                  selectedPostDetail.status === 'Trouvé' ? 'bg-emerald-600 text-white' :
                  selectedPostDetail.status === 'Perdu' ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white'
                }`}>
                  {selectedPostDetail.status}
                </span>
                {selectedPostDetail.reward && (
                  <span className="bg-amber-500 text-white font-bold text-xs px-2.5 py-0.5 rounded">
                    Récompense : {selectedPostDetail.reward}
                  </span>
                )}
              </div>

              <div>
                <h3 className="font-bold text-base mb-2">{selectedPostDetail.title}</h3>
                <div className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                  darkMode ? 'bg-slate-800/50 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <p className="font-semibold text-slate-400 uppercase text-[10px] mb-1">Description :</p>
                  {selectedPostDetail.description || "Aucune description supplémentaire."}
                </div>
              </div>

              <div className={`p-3.5 rounded-xl border flex items-center text-xs ${
                darkMode ? 'bg-slate-800/50 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <MapPin size={16} className="text-emerald-600 mr-2 shrink-0" />
                <div>
                  <p className="font-semibold text-[10px] text-slate-400 uppercase">Localisation</p>
                  <p className="font-bold text-sm">{selectedPostDetail.ville} {selectedPostDetail.quartier ? `(${selectedPostDetail.quartier})` : ''}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <a 
                  href={`https://wa.me/${selectedPostDetail.whatsapp}?text=Bonjour,%20je%20vous%20contacte%20depuis%20Je%20Te%20Falla%20au%20sujet%20de%20:%20${encodeURIComponent(selectedPostDetail.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-3 rounded-xl text-xs flex items-center justify-center space-x-2"
                >
                  <MessageSquare size={16} />
                  <span>WhatsApp</span>
                </a>

                <a 
                  href={`tel:${selectedPostDetail.phone}`}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-semibold py-3 px-3 rounded-xl text-xs flex items-center justify-center space-x-2 dark:bg-slate-700"
                >
                  <Phone size={16} />
                  <span>Appeler</span>
                </a>
              </div>

              <button
                onClick={() => {
                  const target = selectedPostDetail;
                  setSelectedPostDetail(null);
                  setResolvePostTarget(target);
                }}
                className="w-full mt-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1"
              >
                <CheckCircle size={14} />
                <span>Clôturer / Marquer comme retrouvé</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE CLÔTURE PIN */}
      {resolvePostTarget && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className={`rounded-2xl max-w-sm w-full p-5 shadow-xl border text-center ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <h3 className="font-bold text-sm mb-1">Clôturer l'annonce</h3>
            <p className="text-xs text-slate-400 mb-4">Entrez votre code PIN secret :</p>

            <form onSubmit={handleConfirmResolve} className="space-y-3">
              <input
                type="password"
                required
                maxLength="6"
                placeholder="PIN"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className={`w-full p-3 border rounded-xl text-center font-bold text-lg tracking-widest ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200'
                }`}
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setResolvePostTarget(null); setPinInput(''); }}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs"
                >
                  Confirmer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE COMMENTAIRES */}
      {activeCommentsPost && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className={`rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-xl border ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-xs line-clamp-1">{activeCommentsPost.title}</h3>
                <p className="text-[10px] text-slate-400">Commentaires et pistes</p>
              </div>
              <button onClick={() => setActiveCommentsPost(null)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-2.5">
              {comments.filter(c => c.postId === activeCommentsPost.id).length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Aucun commentaire pour le moment.
                </div>
              ) : (
                comments.filter(c => c.postId === activeCommentsPost.id).map(c => (
                  <div key={c.id} className={`p-3 rounded-xl text-xs border ${
                    darkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex justify-between items-center font-semibold mb-1 text-emerald-600 dark:text-emerald-400">
                      <span>{c.auteur}</span>
                      <span className="text-[10px] text-slate-400 font-normal">{c.dateStr}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">{c.texte}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddComment} className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
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
                  placeholder="Écrire une information utile..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className={`flex-1 p-2.5 rounded-xl text-xs border ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'
                  }`}
                />
                <button
                  type="submit"
                  disabled={sendingComment}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 rounded-xl font-semibold text-xs flex items-center justify-center shrink-0"
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
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className={`rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl border ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-inherit z-10">
              <h3 className="font-bold text-xs uppercase tracking-wide">
                Publier : {activeTab === 'recherche' ? 'Avis de recherche' : 'Objet perdu'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitNewPost} className="p-5 space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold uppercase mb-1 text-slate-400">Catégorie</label>
                <select
                  value={newPost.category}
                  onChange={(e) => setNewPost({ ...newPost, category: e.target.value })}
                  className={`w-full p-2.5 border rounded-xl text-xs font-medium ${
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
                <label className="block text-[11px] font-semibold uppercase mb-1 text-slate-400">Titre *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: CNI au nom de NKOLO Paul"
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                  className={`w-full p-2.5 border rounded-xl text-xs ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase mb-1 text-slate-400">Description</label>
                <textarea
                  rows="3"
                  placeholder="Détails supplémentaires..."
                  value={newPost.description}
                  onChange={(e) => setNewPost({ ...newPost, description: e.target.value })}
                  className={`w-full p-2.5 border rounded-xl text-xs ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200'
                  }`}
                ></textarea>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase mb-1 text-slate-400">Photo (Optionnel)</label>
                <div className={`p-4 border-2 border-dashed rounded-xl text-center relative cursor-pointer ${
                  darkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'
                }`}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  {imagePreview ? (
                    <img src={imagePreview} alt="Aperçu" className="h-24 object-cover mx-auto rounded-lg" />
                  ) : (
                    <div className="flex flex-col items-center py-2 text-slate-400">
                      <UploadCloud size={24} className="mb-1 text-emerald-600" />
                      <span className="text-xs font-medium">Ajouter une photo</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase mb-1 text-slate-400">Ville</label>
                  <select
                    value={newPost.ville}
                    onChange={(e) => setNewPost({ ...newPost, ville: e.target.value })}
                    className={`w-full p-2.5 border rounded-xl text-xs font-medium ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    {VILLES_CAMEROUN.filter(v => v !== "Toutes les villes").map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase mb-1 text-slate-400">Quartier</label>
                  <input
                    type="text"
                    placeholder="ex: Akwa"
                    value={newPost.quartier}
                    onChange={(e) => setNewPost({ ...newPost, quartier: e.target.value })}
                    className={`w-full p-2.5 border rounded-xl text-xs ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase mb-1 text-slate-400">Téléphone *</label>
                  <input
                    type="tel"
                    required
                    placeholder="6XXXXXXXX"
                    value={newPost.phone}
                    onChange={(e) => setNewPost({ ...newPost, phone: e.target.value })}
                    className={`w-full p-2.5 border rounded-xl text-xs font-medium ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase mb-1 text-slate-400">Code PIN Secret *</label>
                  <input
                    type="password"
                    required
                    maxLength="6"
                    placeholder="ex: 1234"
                    value={newPost.pinCode}
                    onChange={(e) => setNewPost({ ...newPost, pinCode: e.target.value })}
                    className={`w-full p-2.5 border rounded-xl text-xs font-medium ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl shadow-sm text-xs uppercase tracking-wider flex items-center justify-center space-x-2 mt-4"
              >
                {submitting ? <Loader className="animate-spin" size={16} /> : <span>Valider la publication</span>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}