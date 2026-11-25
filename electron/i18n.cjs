// The words the desktop shell shows outside the window: the tray menu and its notice.
const TEXT = {
  en: {
    open: 'Open DANNA',
    learn: 'Continue learning',
    review: 'Quick review',
    quit: 'Quit DANNA',
    hint: 'DANNA is still running. Click the tray icon to open it again.',
  },
  pt: {
    open: 'Abrir o DANNA',
    learn: 'Continuar estudando',
    review: 'Revisão rápida',
    quit: 'Sair do DANNA',
    hint: 'O DANNA continua aberto. Clique no ícone da bandeja para abri-lo de novo.',
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
