const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push(
  'bin', 'txt', 'jpg', 'png', 'json', 'mp4', 'ttf', 'otf', 'xml'
);

config.resolver.sourceExts.push('ts', 'tsx');

module.exports = config;