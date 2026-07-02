/* ==========================================================================
   NEXRA TECH PK - MASTER ENTERPRISE HYBRID ENGINE
   Provider: Firebase (NoSQL/Auth) + Supabase (SQL/Storage)
   Description: Single Source of Truth for Database, Storage, and Branding.
   ========================================================================== */

/**
 * --------------------------------------------------------------------------
 * 1. FIREBASE CONFIGURATION (Authentication & Real-time NoSQL)
 * --------------------------------------------------------------------------
 * Why Firebase? We use Firebase for seamless Google/Email Authentication 
 * and Firestore for ultra-fast, real-time UI state syncing (like live 
 * notifications, maintenance mode toggles, and feature flags).
 */
const firebaseConfig = {
    apiKey: "AIzaSyDeNZBtVQ5iX5PjV5Gj4xXgxqB3KaJ4cZw",
    authDomain: "nexrapk.firebaseapp.com",
    projectId: "nexrapk",
    storageBucket: "nexrapk.firebasestorage.app", // NOT USED FOR UPLOADS (Constraint applied)
    messagingSenderId: "958761878252",
    appId: "1:958761878252:web:099246eb11de0e08755bc9",
    measurementId: "G-FRTWEZ47YZ"
};

// Initialize Firebase only once
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Global Firebase References
window.db = typeof firebase !== 'undefined' ? firebase.firestore() : null;
window.auth = typeof firebase !== 'undefined' ? firebase.auth() : null;

// Enable Offline Persistence for Firestore (without multi-tab warning)
if (window.db) {
    window.db.enablePersistence().catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn("[Nexra Core] Offline persistence failed: Multiple tabs open.");
        } else if (err.code === 'unimplemented') {
            console.warn("[Nexra Core] Offline persistence not supported by this browser.");
        }
    });
}

/**
 * --------------------------------------------------------------------------
 * 3. CENTRALIZED ASSET & BRANDING ENGINE
 * --------------------------------------------------------------------------
 * This is the SINGLE SOURCE OF TRUTH for all visual assets. 
 * UI components must NEVER hardcode image URLs. They must call:
 * NexraBrand.getAsset('logo')
 */
// Dynamic 50/50 Edition Assignment
const _assignedEdition = (function() {
    let saved = localStorage.getItem('nexra_edition');
    if (!saved) {
        saved = Math.random() < 0.5 ? 'alpha' : 'beta';
        localStorage.setItem('nexra_edition', saved);
    }
    return saved;
})();

window.NexraBrand = {
    activeEdition: _assignedEdition,
    
    // Festival Mode Override (Controlled by Firestore)
    festivalMode: {
        active: false,
        priorityLogo: null,
        priorityFavicon: null,
        themeColor: null,
        watermark: null,
        siteTitle: null,
        banner: null
    },

    // The Asset Packages
    assets: {
        alpha: { // Purple Edition
            themeColor: "#a855f7",
            logo: "https://uploads.onecompiler.io/42yatf6fu/1782533644984/logo_purple.png",
            favicon: "https://uploads.onecompiler.io/42yatf6fu/1782533644984/logo_purple.png",
            textTitle: "https://uploads.onecompiler.io/42yatf6fu/1782533719856/text_title_p.png",
            watermark: "https://uploads.onecompiler.io/42yatf6fu/1782533795284/watermark_purple.png",
            appName: 'Nexra Tech PK',
            siteTitle: 'Nexra Tech PK | Premium Digital Assets'
        },
        beta: {  // Orange Edition (Default)
            themeColor: "#FF4A17",
            logo: "https://uploads.onecompiler.io/42yatf6fu/1782533768745/logo_orange%20y.png",
            favicon: "https://uploads.onecompiler.io/42yatf6fu/1782533768745/logo_orange%20y.png",
            textTitle: "https://uploads.onecompiler.io/42yatf6fu/1782533702320/text_title%20o.png",
            watermark: "https://uploads.onecompiler.io/42yatf6fu/1782533728574/watermark_orange.png",
            appName: 'Nexra Tech PK',
            siteTitle: 'Nexra Tech PK | Premium Digital Assets'
        }
    },

    /**
     * Switch entire app branding instantly
     */
    switchEdition: function(editionName) {
        if (!this.assets[editionName]) return;
        this.activeEdition = editionName;
        localStorage.setItem('nexra_edition', editionName);
        this.refreshDOMAssets();
        console.log(`[Nexra Brand] Switched to ${editionName.toUpperCase()} Edition`);
    },

    /**
     * Get the correct asset URL based on Edition and Festival status.
     */
    getAsset: function(type) {
        if (this.festivalMode.active) {
            if (type === 'logo' && this.festivalMode.priorityLogo) return this.festivalMode.priorityLogo;
            if (type === 'favicon' && this.festivalMode.priorityFavicon) return this.festivalMode.priorityFavicon;
            if (type === 'watermark' && this.festivalMode.watermark) return this.festivalMode.watermark;
        }

        const edition = this.assets[this.activeEdition];
        return edition ? edition[type] : this.assets['beta'][type];
    },

    /**
     * Updates all image tags in the DOM that use the dynamic branding classes
     */
    refreshDOMAssets: function() {
        // Sync document metadata
        document.title = this.getAsset('siteTitle') || 'Nexra Tech PK';
        
        // Sync Logo
        document.querySelectorAll('.nx-brand-logo').forEach(img => {
            img.src = this.getAsset('logo');
        });
        document.querySelectorAll('.nx-brand-title').forEach(el => el.src = this.getAsset('textTitle'));
        document.querySelectorAll('.nx-brand-watermark').forEach(el => el.src = this.getAsset('watermark'));
        
        const favicon = document.getElementById('dynamic-favicon');
        if(favicon) favicon.href = this.getAsset('favicon');
        
        const appleIcon = document.getElementById('dynamic-apple-icon');
        if(appleIcon) appleIcon.href = this.getAsset('favicon');

        // Apply theme color styling (with support for festival override)
        let themeColor = this.assets[this.activeEdition].themeColor;
        if (this.festivalMode.active && this.festivalMode.themeColor) {
            themeColor = this.festivalMode.themeColor;
        }

        document.documentElement.style.setProperty('--brand-main', themeColor);
        document.documentElement.style.setProperty('--brand-glow', themeColor + '40');
    }
};

/**
 * --------------------------------------------------------------------------
 * 4. HYBRID STORAGE ABSTRACTION LAYER
 * --------------------------------------------------------------------------
 */
window.NexraStorage = {
    toBase64: (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    }),

    upload: async function(file, bucket = 'general') {
        const MAX_BASE64_SIZE = 50 * 1024; // 50KB

        if (file.size <= MAX_BASE64_SIZE) {
            console.log("[Storage] File is small. Encoding to Base64...");
            return await this.toBase64(file);
        } else {
            throw new Error("File too large. Only files up to 50KB are supported natively without external storage.");
        }
    }
};

/**
 * --------------------------------------------------------------------------
 * 5. GLOBAL ROUTE REGISTRY
 * --------------------------------------------------------------------------
 */
window.NexraRoutes = {
    baseUrl: "https://nexrapk.vercel.app", // Single Source of Truth Base URL
    registry: {
        'home': '/discovery/home.html',
        'search': '/discovery/search-results.html',
        'coming-soon': '/system/coming-soon.html',
        'shop': '/shop/shop.html',
        'product-detail': '/shop/product-detail.html',
        'checkout': '/shop/checkout.html',
        'checkout-success': '/shop/checkout-success.html',
        'free-vault': '/freebies/free-vault.html',
        'freebie-detail': '/freebies/freebie-detail.html',
        'blog': '/academy/blog.html',
        'blog-detail': '/academy/blog-detail.html',
        'auth-gate': '/user/auth-gate.html',
        'profile-dashboard': '/user/profile-dashboard.html',
        'user-vault': '/user/user-vault.html',
        'user-wallet': '/user/user-wallet.html',
        'wishlist': '/user/wishlist.html',
        'support-hub': '/support/support-hub.html',
        'support-chat': '/support/support-chat.html',
        'about': '/system/about.html',
        'policies': '/system/policies.html',
        'error-404': '/system/error-404.html'
    },
    
    generateURL: function(key, params = '') {
        const path = this.registry[key] || this.registry['error-404'];
        return `${this.baseUrl}${path}${params}`;
    }
};

/**
 * --------------------------------------------------------------------------
 * 6. CENTRALIZED SERVICE ABSTRACTION LAYER (Future-proof for Supabase)
 * --------------------------------------------------------------------------
 */
window.NexraServices = {
    // Database Abstraction
    db: {
        getDoc: async function(col, id) {
            if (!window.db) return null;
            const doc = await window.db.collection(col).doc(id).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        },
        setDoc: async function(col, id, data) {
            if (!window.db) return;
            await window.db.collection(col).doc(id).set(data);
        },
        addDoc: async function(col, data) {
            if (!window.db) return null;
            const docRef = await window.db.collection(col).add(data);
            return docRef.id;
        },
        updateDoc: async function(col, id, data) {
            if (!window.db) return;
            await window.db.collection(col).doc(id).update(data);
        },
        deleteDoc: async function(col, id) {
            if (!window.db) return;
            await window.db.collection(col).doc(id).delete();
        },
        onSnapshot: function(col, id, callback, errorCallback) {
            if (!window.db) return () => {};
            return window.db.collection(col).doc(id).onSnapshot(doc => {
                callback(doc.exists ? { id: doc.id, ...doc.data() } : null);
            }, errorCallback);
        },
        onCollectionSnapshot: function(col, callback, queryBuilder, errorCallback) {
            if (!window.db) return () => {};
            let ref = window.db.collection(col);
            if (queryBuilder) {
                ref = queryBuilder(ref);
            }
            return ref.onSnapshot(snapshot => {
                const results = [];
                snapshot.forEach(doc => {
                    results.push({ id: doc.id, ...doc.data() });
                });
                callback(results);
            }, errorCallback);
        },
        increment: function(val) {
            return firebase.firestore.FieldValue.increment(val);
        },
        serverTimestamp: function() {
            return firebase.firestore.FieldValue.serverTimestamp();
        }
    },

    // Authentication Abstraction
    auth: {
        getCurrentUser: function() {
            return window.auth ? window.auth.currentUser : null;
        },
        onAuthStateChanged: function(callback) {
            if (!window.auth) return () => {};
            return window.auth.onAuthStateChanged(callback);
        },
        signInWithEmail: async function(email, password) {
            return await window.auth.signInWithEmailAndPassword(email, password);
        },
        signUpWithEmail: async function(email, password) {
            return await window.auth.createUserWithEmailAndPassword(email, password);
        },
        signInWithGoogle: async function() {
            const provider = new firebase.auth.GoogleAuthProvider();
            return await window.auth.signInWithPopup(provider);
        },
        signOut: async function() {
            return await window.auth.signOut();
        },
        sendPasswordReset: async function(email) {
            return await window.auth.sendPasswordResetEmail(email);
        }
    },

    // Storage Abstraction
    storage: {
        upload: async function(file, bucket = 'general') {
            return await window.NexraStorage.upload(file, bucket);
        }
    },

    // Notifications Abstraction
    notifications: {
        send: async function(uid, title, message, type = 'info') {
            return await window.NexraServices.db.addDoc(`users/${uid}/notifications`, {
                title,
                message,
                type,
                read: false,
                createdAt: window.NexraServices.db.serverTimestamp()
            });
        }
    },

    // Analytics Abstraction
    analytics: {
        logEvent: function(eventName, eventParams = {}) {
            if (typeof firebase !== 'undefined' && firebase.analytics) {
                try { firebase.analytics().logEvent(eventName, eventParams); } catch(e) {}
            }
            console.log(`[Analytics] ${eventName}`, eventParams);
        }
    },

    // Sharing Abstraction
    sharing: {
        generateProductUrl: function(productSlug) {
            return `${window.NexraRoutes.baseUrl}/product/${productSlug}`;
        },
        getShareText: function(title, productSlug) {
            return `Check out ${title} on Nexra Tech PK: ${this.generateProductUrl(productSlug)}`;
        }
    }
};

// Initialize DOM bindings once window loads
window.addEventListener('DOMContentLoaded', () => {
    if(window.NexraBrand) window.NexraBrand.refreshDOMAssets();
});
