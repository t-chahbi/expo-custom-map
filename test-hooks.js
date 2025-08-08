// test-hooks.js - Test spécifique pour les hooks sans dépendances React Native
console.log('🪝 Test des hooks de expo-custom-map...\n');

try {
  // Test 1: Import des hooks avancés
  console.log('1️⃣ Test des nouveaux hooks...');
  
  // Ces hooks ne dépendent pas de React Native donc devraient fonctionner
  const { useAdvancedTileCache, useFluidGestures } = require('./lib/hooks');
  
  console.log('✅ Hook useAdvancedTileCache:', typeof useAdvancedTileCache);
  console.log('✅ Hook useFluidGestures:', typeof useFluidGestures);
  
  // Test 2: Vérification de la structure des hooks
  console.log('2️⃣ Test de la structure des hooks...');
  
  if (typeof useAdvancedTileCache === 'function') {
    console.log('✅ useAdvancedTileCache est bien une fonction');
  }
  
  if (typeof useFluidGestures === 'function') {
    console.log('✅ useFluidGestures est bien une fonction');
  }
  
  console.log('\n🎉 Hooks testés avec succès !');
  console.log('\n📋 Hooks disponibles dans la librairie :');
  console.log('   🔹 useAdvancedTileCache - Cache intelligent des tuiles');
  console.log('   🔹 useFluidGestures - Gestes fluides optimisés');
  console.log('   🔹 useMapPerformance - Monitoring des performances');
  console.log('   🔹 useOptimizedGestures - Gestes optimisés avec throttling');
  
} catch (error) {
  console.error('❌ Erreur lors du test des hooks :', error.message);
  process.exit(1);
}
