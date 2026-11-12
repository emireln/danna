// The words the desktop shell shows outside the window: the tray menu and its notice.
const TEXT = {
  en: {
    open: 'Open danna',
    learn: 'Continue learning',
    review: 'Quick review',
    quit: 'Quit danna',
    hint: 'danna is still running. Click the tray icon to open it again.',
  },
  pt: {
    open: 'Abrir o danna',
    learn: 'Continuar estudando',
    review: 'Revisão rápida',
    quit: 'Sair do danna',
    hint: 'O danna continua aberto. Clique no ícone da bandeja para abri-lo de novo.',
  },
};

// The language chosen in the app wins. Without one, the system language decides.
function shellLanguage(saved, systemLocale) {
  if (saved === 'en' || saved === 'pt') return saved;
  return String(systemLocale || '').toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

function shellText(language) {
  return TEXT[language] || TEXT.en;
}

module.exports = { shellLanguage, shellText };
