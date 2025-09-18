# Controle Financeiro Pessoal

Uma aplicação completa de gerenciamento financeiro pessoal com suporte para múltiplas contas, transações com data e hora, controle de gastos fixos, acompanhamento de dívidas e sistema de cofrinhos com rendimento CDI.

## 🚀 Recursos

- **Sistema de Autenticação**: Login/registro com Firebase ou modo demo local
- **Múltiplas Caixas**: Conta corrente, poupança, carteira e investimentos
- **Transações Detalhadas**: Registre entradas e saídas com data, hora e categorias
- **Gastos Fixos**: Controle mensal com sistema de pagamento
- **Gestão de Dívidas**: Acompanhe dívidas totais e parceladas
- **Cofrinhos Inteligentes**: Sistema de poupança com rendimento CDI simulado
- **Dashboard Visual**: Gráficos e resumos de suas finanças
- **Responsivo**: Interface otimizada para desktop e mobile
- **Categorias Personalizadas**: Crie e gerencie suas próprias categorias

## 🎯 Como Usar

### Modo Demo (Padrão)

A aplicação funciona imediatamente em modo demo:

1. **Login Demo**: Use `demo@teste.com` / `demo123`
2. **Ou Criar Conta**: Registre qualquer email/senha fictício
3. **Dados Locais**: Tudo fica salvo no navegador

### Configuração Firebase (Produção)

Para dados persistentes e acesso multi-dispositivo:

1. Siga as instruções em `FIREBASE_SETUP.md`
2. Configure as variáveis de ambiente
3. Deploy na Vercel ou plataforma de sua escolha

## 📱 Navegação

### Desktop
- **Sidebar**: Menu lateral com todas as seções
- **Dashboard**: Visão geral das finanças
- **Caixas**: Gerencie suas contas e cofrinhos
- **Transações**: Registre movimentações com hora
- **Gastos Fixos**: Controle despesas mensais
- **Dívidas**: Acompanhe parcelamentos

### Mobile
- **Menu Hambúrguer**: Acesso ao menu lateral
- **Navegação Inferior**: Acesso rápido às funções principais
- **Interface Otimizada**: Touch-friendly com elementos grandes

## 🔧 Recursos Técnicos

- **React + TypeScript**: Base sólida e tipada
- **Tailwind CSS v4**: Estilização moderna
- **Firebase**: Autenticação e banco de dados
- **Recharts**: Gráficos interativos
- **Lucide Icons**: Ícones modernos
- **ShadCN/UI**: Componentes acessíveis

## 💾 Armazenamento

- **Modo Demo**: localStorage (dados locais)
- **Modo Firebase**: Firestore (nuvem, sincronizado)

## 📊 Dashboard

Visualize em tempo real:
- Saldo total das caixas
- Valor dos cofrinhos (separado)
- Gastos fixos do mês
- Dívidas pendentes
- Gráficos de distribuição por categoria
- Próximos vencimentos

## 🎨 Interface

- **Design Limpo**: Interface minimalista e funcional
- **Modo Escuro**: Suporte completo a dark/light mode
- **Acessibilidade**: Componentes acessíveis por padrão
- **Performance**: Carregamento rápido e otimizado

## 🔐 Segurança

- **Autenticação Segura**: Firebase Auth ou mock local
- **Dados Isolados**: Cada usuário acessa apenas seus dados
- **Validações**: Campos obrigatórios e validações de entrada

## 📈 Futuras Melhorias

- Relatórios avançados
- Exportação de dados
- Notificações de vencimento
- Integração bancária
- Metas financeiras
- Backup automático

---

**Desenvolvido para simplificar o controle das suas finanças pessoais.**