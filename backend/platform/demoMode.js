function isDemoMode() {
  return process.env.DEMO_MODE === 'true';
}

module.exports = { isDemoMode };
