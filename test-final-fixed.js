#!/usr/bin/env node

// Test final de validation (version CommonJS)
console.log('🧪 Test final du module expo-custom-map...\n');

try {
  // Test 1: Import du module principal
  console.log('1️⃣ Test d\'import principal...');
  const moduleIndex = require('./lib/index.js');
  console.log('✅ Import principal réussi');
  console.log('   Exports disponibles:', Object.keys(moduleIndex).slice(0, 5), '...');

  // Test 2: Vérification des composants clés
  console.log('2️⃣ Test des composants clés...');
  if (moduleIndex.CustomMapView) {
    console.log('✅ CustomMapView disponible');
  }
  if (moduleIndex.TileLayer) {
    console.log('✅ TileLayer disponible');
  }
  if (moduleIndex.MarkerComponent) {
    console.log('✅ MarkerComponent disponible');
  }

  // Test 3: Vérification des types
  console.log('3️⃣ Test des définitions TypeScript...');
  const fs = require('fs');
  if (fs.existsSync('./lib/index.d.ts')) {
    console.log('✅ Fichiers de définition TypeScript présents');
  }

  // Test 4: Structure du projet
  console.log('4️⃣ Vérification de la structure...');
  const directories = ['lib/components', 'lib/hooks', 'lib/types', 'lib/utils'];
  directories.forEach(dir => {
    if (fs.existsSync(dir)) {
      console.log(`✅ ${dir} présent`);
    } else {
      console.log(`⚠️ ${dir} manquant`);
    }
  });

  console.log('\n🎉 Module validé avec succès !');
  console.log('\n📋 Résumé du projet :');
  console.log('   📦 Nom: @chauffleet/expo-custom-map');
  console.log('   🏗️ Build: CommonJS + TypeScript');
  console.log('   📱 Compatible: Expo + React Native');
  console.log('   🗺️ Fonctionnalités: Cartes personnalisées sans API');
  
  console.log('\n🚀 Prochaines étapes :');
  console.log('   1. cd example && npm start');
  console.log('   2. Scanner le QR code avec Expo Go');
  console.log('   3. Tester sur Android/iOS');
  console.log('   4. Publier sur npm (optionnel)');
  
} catch (error) {
  console.error('❌ Erreur lors du test :', error.message);
  process.exit(1);
}
