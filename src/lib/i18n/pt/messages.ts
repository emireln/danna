// The messages shown when something goes wrong, from the app, the data layer and the desktop side.
// Each English text is the one the code uses. Messages with a provider name in them are in ../index.ts.
export const MESSAGES_PT: Record<string, string> = {
  // Sign-in and accounts
  'Something went wrong. Please try again.': 'Algo deu errado. Tente de novo.',
  'That email and password do not match. Please try again.': 'O e-mail e a senha não correspondem. Tente de novo.',
  'Please confirm your email first. Check your inbox for the link.': 'Confirme seu e-mail primeiro. Procure o link na sua caixa de entrada.',
  'That email already has an account. Try signing in instead.': 'Este e-mail já tem uma conta. Tente entrar.',
  'Use a password with at least 8 characters.': 'Use uma senha com pelo menos 8 caracteres.',
  'Too many attempts. Please wait a moment and try again.': 'Muitas tentativas. Espere um pouco e tente de novo.',
  'We could not connect. Check your internet connection and try again.': 'Não foi possível conectar. Confira sua conexão com a internet e tente de novo.',
  'That name is already taken. Try another one.': 'Este nome já está em uso. Tente outro.',
  'You have reached the limit for this. Remove some items and try again.': 'Você chegou ao limite. Remova alguns itens e tente de novo.',
  'Your session has ended. Please sign in again.': 'Sua sessão terminou. Entre de novo.',
  'Your session has expired. Sign in again to continue.': 'Sua sessão expirou. Entre de novo para continuar.',
  'That username is taken. Try another one.': 'Este nome de usuário já está em uso. Tente outro.',
  'You already have a request or friendship with this person.': 'Você já tem um pedido ou uma amizade com esta pessoa.',
  'This is available with an online account.': 'Isto está disponível com uma conta online.',

  // Pictures and files
  'That picture type cannot be saved. Try another one.': 'Este formato de foto não pode ser salvo. Tente outra.',
  'That picture is too large. Choose a smaller one.': 'Esta foto é grande demais. Escolha uma menor.',
  'That picture could not be saved. Try another one.': 'Esta foto não pôde ser salva. Tente outra.',
  'Choose a photo or image file, such as JPG, PNG or WebP.': 'Escolha uma foto ou um arquivo de imagem, como JPG, PNG ou WebP.',
  'That picture is too large. Choose one under 15 MB.': 'Esta foto é grande demais. Escolha uma com menos de 15 MB.',
  'We could not read that picture. Try another one.': 'Não conseguimos ler esta foto. Tente outra.',
  'This picture could not be prepared. Try again.': 'Não foi possível preparar esta foto. Tente de novo.',
  'That picture is too detailed to save. Try a simpler one.': 'Esta foto tem detalhes demais para ser salva. Tente uma mais simples.',
  'This device cannot save pictures yet.': 'Este dispositivo ainda não consegue salvar fotos.',
  'Not enough space on this device. Free some space and try again.': 'Não há espaço suficiente neste dispositivo. Libere um pouco de espaço e tente de novo.',
  'Files are kept in the desktop app or in your online account.': 'Os arquivos ficam no app de computador ou na sua conta online.',
  'That link is no longer in your library.': 'Este link não está mais na sua biblioteca.',
  'That lesson could not be saved.': 'Esta lição não pôde ser salva.',
  'That practice set is too large to keep.': 'Este conjunto de treino é grande demais para ser salvo.',
  'Paste a web link that starts with https://.': 'Cole um link da web que comece com https://.',
  'Only PDF, TXT and Markdown files can be kept in the library.': 'Só é possível guardar na biblioteca arquivos PDF, TXT e Markdown.',
  'That file is too large. Choose one under 20 MB.': 'Este arquivo é grande demais. Escolha um com menos de 20 MB.',

  // The desktop side: keys, providers and the coach
  'That AI provider is not supported.': 'Este provedor de IA não é compatível.',
  'That message could not be sent. Try again.': 'Não foi possível enviar esta mensagem. Tente de novo.',
  'Paste your AI key to connect it.': 'Cole sua chave de IA para conectá-la.',
  'Paste the whole key. It should not contain spaces.': 'Cole a chave inteira. Ela não pode ter espaços.',
  'We do not recognize this key yet. Try an OpenAI, Anthropic, Gemini, OpenRouter or DeepSeek key.':
    'Não reconhecemos esta chave. Tente uma chave da OpenAI, Anthropic, Gemini, OpenRouter ou DeepSeek.',
  'This key was not accepted. Check that it is complete and still active.': 'Esta chave não foi aceita. Confira se ela está completa e ainda ativa.',
  'Connect this provider first.': 'Conecte este provedor primeiro.',
  'Choose a model from the list.': 'Escolha um modelo da lista.',
  'Add an AI key in Settings to use this feature.': 'Adicione uma chave de IA em Configurações para usar este recurso.',
  'Your AI key is missing. Add it again in Settings.': 'Sua chave de IA não está mais salva. Adicione-a de novo em Configurações.',
  'Add an OpenAI key in Settings to transcribe speaking answers.': 'Adicione uma chave da OpenAI em Configurações para transcrever as respostas faladas.',
  'No recording was found. Try again.': 'Nenhuma gravação foi encontrada. Tente de novo.',
  'That recording is too long. Try a shorter answer.': 'Esta gravação é longa demais. Tente uma resposta mais curta.',
  'That action is not available right now.': 'Esta ação não está disponível agora.',
  'That link cannot be opened.': 'Este link não pode ser aberto.',
  'Write a message first.': 'Escreva uma mensagem primeiro.',
  'We could not save your key on this device.': 'Não foi possível salvar sua chave neste dispositivo.',
  'That sign-in data is too large to keep.': 'Estes dados de acesso são grandes demais para ser salvos.',
  'The reply ran out of room before it was written. Try a shorter question.': 'A resposta ficou sem espaço antes de ser escrita. Tente uma pergunta mais curta.',
  'The assistant did not reply this time. Please try again.': 'O assistente não respondeu desta vez. Tente de novo.',

  // Review
  'Review question': 'Pergunta para revisar',
  'Put the words of this sentence in the right order.': 'Coloque as palavras desta frase na ordem certa.',

  // Coach chats and files
  'This chat could not be found.': 'Este chat não foi encontrado.',
  'You have reached the limit for chats. Delete some chats and try again.': 'Você atingiu o limite de chats. Exclua alguns chats e tente de novo.',
  'Only pictures, PDF, TXT and Markdown files can be sent.': 'Só é possível enviar imagens e arquivos PDF, TXT e Markdown.',
  'This file is larger than 20 MB.': 'Este arquivo tem mais de 20 MB.',
  'This picture could not be read. Try another one.': 'Não foi possível ler esta imagem. Tente outra.',
  'This PDF has no readable text yet. A scanned PDF needs its text first.': 'Este PDF ainda não tem texto legível. Um PDF escaneado precisa de texto antes.',
  'This file has no text in it.': 'Este arquivo não tem texto.',
  'DeepSeek cannot read pictures yet. Remove the pictures, or choose another provider in Settings.':
    'O DeepSeek ainda não lê imagens. Remova as imagens ou escolha outro provedor em Configurações.',
};
