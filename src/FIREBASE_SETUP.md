# Configuração do Firebase

## Modo Demo

Por padrão, a aplicação funciona em **modo demo** com dados salvos localmente no navegador. Você pode criar qualquer conta e testar todas as funcionalidades sem configurar o Firebase.

Para usar persistência permanente e acesso de múltiplos dispositivos, siga as instruções abaixo para configurar o Firebase.

## Configuração Completa do Firebase

### 1. Criar projeto no Firebase

1. Acesse https://console.firebase.google.com/
2. Clique em "Criar projeto"
3. Nomeie seu projeto (ex: "controle-financeiro")
4. Desabilite o Google Analytics (opcional)
5. Clique em "Criar projeto"

### 2. Configurar Authentication

1. No console do Firebase, vá para "Authentication" > "Get started"
2. Na aba "Sign-in method", habilite "Email/password"
3. Salve as configurações

### 3. Configurar Firestore Database

1. Vá para "Firestore Database" > "Create database"
2. Escolha "Start in test mode" (por enquanto)
3. Selecione uma localização próxima ao Brasil (ex: us-central1)
4. Clique em "Done"

### 4. Obter configurações do projeto

1. Vá para "Project settings" (ícone de engrenagem)
2. Na seção "Your apps", clique no ícone web (</>)
3. Digite um nome para seu app (ex: "controle-financeiro-web")
4. NÃO marque "Also set up Firebase Hosting"
5. Clique em "Register app"
6. Copie o objeto `firebaseConfig`

### 5. Atualizar o arquivo firebase.ts

Substitua as configurações no arquivo `/lib/firebase.ts`:

```typescript
const firebaseConfig = {
  apiKey: "sua-api-key-aqui",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto-id",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

### 6. Regras de segurança do Firestore

Vá para "Firestore Database" > "Rules" e configure as seguintes regras:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Apenas usuários autenticados podem acessar seus próprios dados
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 7. Deploy na Vercel

1. Conecte seu repositório GitHub à Vercel
2. Configure as variáveis de ambiente na Vercel:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

3. Atualize o arquivo `/lib/firebase.ts` para usar as variáveis de ambiente:

```typescript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
```

### 8. Domínio autorizado

1. No Firebase Console, vá para "Authentication" > "Settings" > "Authorized domains"
2. Adicione seu domínio da Vercel (ex: `seu-app.vercel.app`)

### 9. Estrutura do banco de dados

O banco será organizado da seguinte forma:

```
users/
  {userId}/
    caixas/
      {caixaId}/
    transacoes/
      {transacaoId}/
    gastosFixos/
      {gastoFixoId}/
    dividas/
      {dividaId}/
    cofrinhos/
      {cofrinhoId}/
    categorias/
      {categoriaId}/
```

Cada usuário terá seus dados isolados em sua própria coleção.