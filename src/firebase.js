// src/firebase.js
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc,
  updateDoc,
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCL3Fhg1FEu7In5qirTCtHyiRYAGUTpHQQ",
  authDomain: "je-te-falla.firebaseapp.com",
  projectId: "je-te-falla",
  storageBucket: "je-te-falla.firebasestorage.app",
  messagingSenderId: "816595879257",
  appId: "1:816595879257:web:c1608e8e18701d78dbb848"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

const POSTS_COLLECTION = "annonces";
const COMMENTS_COLLECTION = "commentaires";

// Ajouter une nouvelle annonce
export const ajouterAnnonce = async (annonceData) => {
  try {
    const docRef = await addDoc(collection(db, POSTS_COLLECTION), {
      ...annonceData,
      resolved: false,
      createdAt: serverTimestamp()
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Erreur d'ajout d'annonce:", error);
    return { success: false, error };
  }
};

// Marquer une annonce comme retrouvée (seul le PIN de l'auteur déverrouille l'action)
export const marquerCommeRetrouve = async (postId, pinCodeInput, originalPin) => {
  try {
    if (pinCodeInput !== originalPin) {
      return { success: false, error: "Code PIN incorrect ! Seul l'auteur peut retirer cette annonce." };
    }

    const postRef = doc(db, POSTS_COLLECTION, postId);
    await updateDoc(postRef, {
      resolved: true,
      resolvedAt: serverTimestamp(),
      status: "Retrouvé"
    });
    
    return { success: true };
  } catch (error) {
    console.error("Erreur lors de la mise à jour:", error);
    return { success: false, error: "Erreur serveur" };
  }
};

// Écouter les annonces en temps réel
export const ecouterAnnonces = (callback) => {
  const q = query(collection(db, POSTS_COLLECTION), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const annonces = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(annonces);
  });
};

// Ajouter un commentaire sous une annonce
export const ajouterCommentaire = async (postId, auteur, texte) => {
  try {
    const docRef = await addDoc(collection(db, COMMENTS_COLLECTION), {
      postId,
      auteur: auteur || "Citoyen Anonyme",
      texte,
      createdAt: serverTimestamp(),
      dateStr: new Date().toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Erreur d'ajout de commentaire:", error);
    return { success: false, error };
  }
};

// Écouter les commentaires en temps réel
export const ecouterCommentaires = (callback) => {
  const q = query(collection(db, COMMENTS_COLLECTION), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snapshot) => {
    const commentaires = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(commentaires);
  });
};