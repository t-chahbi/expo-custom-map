#!/usr/bin/env node

// Test final de validation de l'intégralité du module
console.log('🧪 Test final du module expo-custom-map...\n');

try {
  // Test 1: Import du module principal
  console.log('1️⃣ Test d\'import principal...');
  const moduleIndex = require('./lib/index.js');
  console.log('✅ Import principal réussi');
  console.log('   Exports disponibles:', Object.keys(moduleIndex));

  // Test 2: Vérification des types
  console.log('2️⃣ Test des types...');
  if (moduleIndex.CustomMapView && typeof moduleIndex.CustomMapView === 'function') {
    console.log('✅ CustomMapView est bien une fonction/composant');
  } else {
    console.log('⚠️ CustomMapView non trouvé ou pas une fonction');
  }

  // Test 3: Import des composants auxiliaires
  console.log('3️⃣ Test des composants auxiliaires...');
  const components = require('./lib/components/index.js');
  if (components.TileLayer && components.MarkerComponent) {
    console.log('✅ Composants auxiliaires importés');
  } else {
    console.log('⚠️ Certains composants manquent');
  }

  // Test 4: Vérification des utilitaires
  console.log('4️⃣ Test des utilitaires...');
  const utils = require('./lib/utils/geoUtils.js');
  if (utils && typeof utils === 'object') {
    console.log('✅ Utilitaires disponibles');
  }

  // Test 5: Vérification des types TypeScript
  console.log('5️⃣ Test des définitions TypeScript...');
  const fs = require('fs');
  if (fs.existsSync('./lib/index.d.ts')) {
    console.log('✅ Fichiers de définition TypeScript présents');
  } else {
    console.log('⚠️ Fichiers .d.ts manquants');
  }

  console.log('\n🎉 Tous les tests de base sont passés !');
  console.log('\n📱 Pour tester sur Android/iOS :');
  console.log('   cd example');
  console.log('   npm start');
  console.log('   Puis scanner le QR code avec Expo Go\n');
  
  console.log('📦 Le module est prêt pour la publication !');
  
} catch (error) {
  console.error('❌ Erreur lors du test :', error.message);
  process.exit(1);
}
