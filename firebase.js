const firebaseConfig = {
  apiKey: "AIzaSyBngwZh3oErADZoTFG6AOqj6QLzwv1R6qY",
  authDomain: "live-scores-tennis-plus.firebaseapp.com",
  projectId: "live-scores-tennis-plus",
  storageBucket: "live-scores-tennis-plus.firebasestorage.app",
  messagingSenderId: "949079557619",
  appId: "1:949079557619:web:d1715339815c28d971be86",
  measurementId: "G-NDT9YVW4C6"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const __auth = firebase.auth();
const __db = firebase.firestore();

window.__auth = __auth;
window.__db = __db;
window.firebaseAppReady = true;
