/* ============================================================
   CONFIG.JS — Conteúdo padrão do site
   ------------------------------------------------------------
   Este arquivo é a "fonte da verdade" dos dados iniciais.
   Quando o localStorage está vazio, o site usa este conteúdo.
   Depois, o admin (Ctrl + Shift + A) pode editar tudo, e as
   mudanças são salvas no localStorage sob a chave CONTENT_KEY.

   Estrutura:
   - branding  → nome, logo, rodapé, SEO
   - hero      → seção principal
   - sobre     → seção "Sobre Joseph"
   - filosofia → frases
   - discografia → álbuns + faixas (preço, prévia, áudio)
   - loja      → configurações globais de preço e desconto
   - planos    → planos de assinatura (Free, Premium, Anual)
   - contato   → redes sociais
   - aparencia → cores e fontes
   
   ⚠️ ATENÇÃO: Mantenha a estrutura exata ao editar.
   O site.js e store.js dependem desses campos específicos.
   ============================================================ */

/**
 * @typedef {Object} Track
 * @property {string} title - Título da faixa
 * @property {string} previewAudio - URL ou idb:// da prévia (vazio = corta da completa)
 * @property {string} fullAudio - URL ou idb:// do áudio completo
 * @property {number} previewStart - Início da prévia em segundos
 * @property {number} previewDuration - Duração da prévia em segundos
 * @property {string} duration - Duração formatada (ex: "3:58")
 * @property {number} price - Preço em R$ (ex: 4.90)
 * @property {boolean} forSale - Se pode ser vendida individualmente
 */

/**
 * @typedef {Object} Album
 * @property {string} id - ID único do álbum
 * @property {'album'|'ep'|'single'} type - Tipo de lançamento
 * @property {string} title - Título do álbum
 * @property {number} year - Ano de lançamento
 * @property {string} cover - Iniciais para fallback (máx 3 caracteres)
 * @property {string} coverImage - URL da capa
 * @property {string} description - Descrição do álbum
 * @property {Track[]} tracks - Lista de faixas
 */

/**
 * @typedef {Object} Plan
 * @property {string} id - ID do plano ('free', 'premium', 'anual')
 * @property {string} name - Nome do plano
 * @property {string} price - Preço formatado (ex: "R$ 19,90")
 * @property {string} suffix - Sufixo do preço (ex: "/mês")
 * @property {string} desc - Descrição curta
 * @property {boolean} featured - Se é destaque
 * @property {string} [badge] - Badge opcional (ex: "Recomendado")
 * @property {Array<{text: string, ok: boolean}>} features - Lista de recursos
 * @property {string} cta - Texto do botão
 * @property {boolean} [disabled] - Se botão está desabilitado
 */

/**
 * @typedef {Object} SocialLink
 * @property {string} icon - Nome do ícone (spotify, youtube, etc)
 * @property {string} label - Nome exibido
 * @property {string} url - URL do perfil
 */

/**
 * @typedef {Object} Content
 * @property {Object} branding - Identidade visual
 * @property {Object} hero - Seção principal
 * @property {Object} sobre - Seção sobre
 * @property {Object} filosofia - Frases filosóficas
 * @property {Object} discografia - Álbuns e faixas
 * @property {Object} loja - Configurações da loja
 * @property {Object} planos - Planos de assinatura
 * @property {Object} contato - Redes sociais
 * @property {Object} aparencia - Cores e fontes
 */

/**
 * Conteúdo padrão do site
 * @type {Content}
 */
const DEFAULT_CONTENT = {
  
  // ========================================
  // BRANDING — Identidade visual e SEO
  // ========================================
  branding: {
    name: "Joseph",
    nameAccent: "Matthos",
    footer: "© 2026 Joseph Matthos. Todos os direitos reservados. ✦ Feito com poesia e beat.",
    metaTitle: "Joseph Matthos | Plataforma Oficial",
    metaDesc: "Rapper poético, filosófico e inspirador. Discografia completa, prévias gratuitas e loja de faixas individuais.",
    bgImage: "assets/img/hero-bg.jpg"
  },

  // ========================================
  // HERO — Seção principal
  // ========================================
  hero: {
    title: "Rimas que<br><span class=\"gold\">pensam.</span>",
    subtitle: "Rapper poético, filosófico e inspirador. Discografia, loja de faixas e assinatura premium.",
    btnPrimaryText: "▶ Explorar discografia",
    btnPrimaryLink: "#discografia",
    btnSecondaryText: "Ver planos",
    btnSecondaryLink: "", // Vazio = abre modal de planos via JS
    vinylLyric: "\u201cNada acabou. Só estamos começando.\u201d", // Aspas tipográficas
    vinylImage: "assets/img/boom-boom-bap-clean.jpg"
  },

  // ========================================
  // SOBRE — Seção "Sobre Joseph"
  // ========================================
  sobre: {
    title: "Sobre <span class=\"gold\">Joseph</span>",
    subtitle: "Entre a poesia concreta e o rap de reflexão, uma voz que incomoda e cura.",
    paragraphs: "<strong>Joseph Matthos</strong> não é apenas um rapper. É um cronista do invisível, um filósofo de esquina, um poeta que encontrou no beat a cadência perfeita para suas inquietações.\nNascido na periferia e formado nas ruas, Joseph transforma vivências cruas em letras que equilibram profundidade e acessibilidade.\nCom influências que vão de <strong>Racionais MC's</strong> a <strong>Fernando Pessoa</strong>, ele constrói pontes entre o sagrado e o cotidiano. Em <strong>Boom, Boom, Bàp</strong> (2026), palavras viram rumor, rumor vira verdade e verdade vira legado.",
    quote: "\u201cMinha rima é a filha da noite que pariu o dia.\u201d",
    image: "assets/img/joseph-sobre.jpg"
  },

  // ========================================
  // FILOSOFIA — Frases e citações
  // ========================================
  filosofia: {
    title: "Filosofia <span class=\"gold\">em rima</span>",
    subtitle: "Fragmentos de pensamentos que atravessam as letras de Joseph.",
    frases: [
      {
        text: "Haverá dias difíceis, mas a missão continua. Enquanto eu respirar, a história não termina. Nada acabou. Só estamos começando.",
        author: "Boom, Boom, Bàp"
      },
      {
        text: "A rua me ensinou que quem tem pressa de chegar esquece de ver a paisagem.",
        author: "Joseph Matthos"
      },
      {
        text: "Não escrevo para ser entendido. Escrevo para me entender.",
        author: "Joseph Matthos"
      },
      {
        text: "A dor é uma professora severa, mas seus ensinamentos são os mais duradouros.",
        author: "Joseph Matthos"
      },
      {
        text: "Entre o sim e o não, escolhi o talvez — e nele construí minha liberdade.",
        author: "Joseph Matthos"
      }
    ]
  },

  // ========================================
  // DISCOGRAFIA — Álbuns, EPs e Singles
  // ========================================
  discografia: {
    title: "Disco<span class=\"gold\">grafia</span>",
    subtitle: "Explore álbuns, EPs e singles. Visitantes ouvem prévias de 30s. Assinantes Premium têm acesso completo + downloads.",
    albums: [
      // ========== ÁLBUM 1: Boom, Boom, Bàp ==========
      {
        id: "album-bbb",
        type: "album",
        title: "Boom, Boom, Bàp",
        year: 2026,
        cover: "BBB",
        coverImage: "assets/img/album-boom-boom-bap.jpg",
        description: "O álbum da maturidade. Palavras que viram rumor, rumor que vira verdade, verdade que vira legado.",
        tracks: [
          {
            title: "Palavras",
            previewAudio: "",
            fullAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3",
            previewStart: 30,
            previewDuration: 30,
            duration: "3:58",
            price: 4.90,
            forSale: true
          },
          {
            title: "Rumor",
            previewAudio: "",
            fullAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3",
            previewStart: 45,
            previewDuration: 30,
            duration: "4:12",
            price: 4.90,
            forSale: true
          },
          {
            title: "Verdade",
            previewAudio: "",
            fullAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3",
            previewStart: 20,
            previewDuration: 30,
            duration: "4:45",
            price: 5.90,
            forSale: true
          },
          {
            title: "Legado",
            previewAudio: "",
            fullAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3",
            previewStart: 60,
            previewDuration: 30,
            duration: "5:20",
            price: 5.90,
            forSale: true
          }
        ]
      },

      // ========== ÁLBUM 2: Silêncio Fértil ==========
      {
        id: "album-1",
        type: "album",
        title: "Silêncio Fértil",
        year: 2024,
        cover: "SF",
        coverImage: "",
        description: "Álbum de estreia. Reflexões sobre identidade, fé e resistência.",
        tracks: [
          {
            title: "Silêncio Fértil",
            previewAudio: "",
            fullAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            previewStart: 30,
            previewDuration: 30,
            duration: "6:12",
            price: 4.90,
            forSale: true
          },
          {
            title: "Fé Inversa",
            previewAudio: "",
            fullAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
            previewStart: 45,
            previewDuration: 30,
            duration: "5:01",
            price: 4.90,
            forSale: true
          },
          {
            title: "Cálice de Verso",
            previewAudio: "",
            fullAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
            previewStart: 20,
            previewDuration: 30,
            duration: "4:48",
            price: 4.90,
            forSale: true
          },
          {
            title: "Ponte para o Nada",
            previewAudio: "",
            fullAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
            previewStart: 60,
            previewDuration: 30,
            duration: "4:15",
            price: 4.90,
            forSale: true
          }
        ]
      },

      // ========== EP: Interlúdio ==========
      {
        id: "ep-1",
        type: "ep",
        title: "Interlúdio",
        year: 2023,
        cover: "IN",
        coverImage: "",
        description: "EP experimental entre o sagrado e o profano.",
        tracks: [
          {
            title: "Oração Urbana",
            previewAudio: "",
            fullAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
            previewStart: 30,
            previewDuration: 30,
            duration: "4:20",
            price: 3.90,
            forSale: true
          },
          {
            title: "Cinzas e Versos",
            previewAudio: "",
            fullAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
            previewStart: 40,
            previewDuration: 30,
            duration: "3:55",
            price: 3.90,
            forSale: true
          }
        ]
      },

      // ========== SINGLE: Vozes na Madrugada ==========
      {
        id: "single-1",
        type: "single",
        title: "Vozes na Madrugada",
        year: 2025,
        cover: "VM",
        coverImage: "",
        description: "Single mais recente. Uma conversa com o silêncio às 3h da manhã.",
        tracks: [
          {
            title: "Vozes na Madrugada",
            previewAudio: "",
            fullAudio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
            previewStart: 35,
            previewDuration: 30,
            duration: "4:02",
            price: 3.90,
            forSale: true
          }
        ]
      }
    ]
  },

  // ========================================
  // LOJA — Configurações de venda de faixas
  // ========================================
  loja: {
    enabled: true,
    title: "Loja de <span class=\"gold\">faixas</span>",
    subtitle: "Compre músicas individuais. Pagamento único, download imediato, sem assinatura.",
    currency: "BRL",
    currencySymbol: "R$",
    discountMinItems: 3,      // Mínimo de itens para aplicar desconto
    discountPercent: 10,      // Percentual de desconto (10 = 10%)
    defaultPrice: 4.90,       // Preço padrão quando track.price é inválido
    showCart: true
  },

  // ========================================
  // PLANOS — Planos de assinatura
  // ========================================
  planos: {
    title: "Escolha seu <span class=\"gold\">plano</span>",
    subtitle: "Apoie a arte independente e tenha acesso ilimitado a toda a obra de Joseph Matthos.",
    plans: [
      // ---------- Plano Free ----------
      {
        id: "free",
        name: "Visitante",
        price: "R$ 0",
        suffix: "/sempre",
        desc: "Para conhecer o som de Joseph Matthos.",
        featured: false,
        badge: null,
        features: [
          { text: "Prévias de 30s de todas as faixas", ok: true },
          { text: "Acesso à discografia completa", ok: true },
          { text: "Compra de faixas individuais", ok: true },
          { text: "Faixas completas na assinatura", ok: false },
          { text: "Downloads ilimitados", ok: false }
        ],
        cta: "Plano atual",
        disabled: true
      },

      // ---------- Plano Premium ----------
      {
        id: "premium",
        name: "Premium",
        price: "R$ 19,90",
        suffix: "/mês",
        desc: "Experiência completa, sem limites.",
        featured: true,
        badge: "Recomendado",
        features: [
          { text: "Toda a discografia desbloqueada", ok: true },
          { text: "Áudio em alta qualidade", ok: true },
          { text: "Downloads ilimitados", ok: true },
          { text: "Loja de faixas incluída", ok: true },
          { text: "Cancele quando quiser", ok: true }
        ],
        cta: "Assinar Premium",
        disabled: false
      },

      // ---------- Plano Anual ----------
      {
        id: "anual",
        name: "Premium Anual",
        price: "R$ 179",
        suffix: "/ano",
        desc: "Economize 25% no plano anual.",
        featured: false,
        badge: null,
        features: [
          { text: "Tudo do Premium mensal", ok: true },
          { text: "2 meses grátis", ok: true },
          { text: "Acesso antecipado a shows", ok: true },
          { text: "Conteúdo exclusivo do bastidor", ok: true },
          { text: "Badge de apoiador oficial", ok: true }
        ],
        cta: "Assinar Anual",
        disabled: false
      }
    ]
  },

  // ========================================
  // CONTATO — Redes sociais e informações
  // ========================================
  contato: {
    title: "Conecte-<span class=\"gold\">se</span>",
    subtitle: "Receba letras inéditas, reflexões e datas de shows.",
    heading: "Vamos trocar ideias.",
    description: "Para convites, parcerias ou apenas para compartilhar um verso, me encontre nas redes.",
    socials: [
      {
        icon: "spotify",
        label: "Spotify",
        url: "https://open.spotify.com/playlist/3flgUEol1uBvFAlriXZE24?si=PtjKfVQuQfms4zMCjyIqaA"
      },
      {
        icon: "youtube",
        label: "YouTube",
        url: "https://www.youtube.com/@josephmatthos"
      },
      {
        icon: "amazon",
        label: "Amazon Music",
        url: "https://music.amazon.com.br/artists/B0H7Z173V1/joseph-matthos"
      },
      {
        icon: "facebook",
        label: "Facebook",
        url: "https://www.facebook.com/profile.php?id=61593112378384"
      },
      {
        icon: "tiktok",
        label: "TikTok",
        url: "https://tiktok.com/@joseph.matthos"
      },
      {
        icon: "apple",
        label: "Apple Music",
        url: "https://music.apple.com/us/artist/joseph-matthos/6802310570"
      },
      {
        icon: "audiomack",
        label: "Audiomack",
        url: "https://audiomack.com/josephmatthos"
      }
    ]
  },

  // ========================================
  // APARÊNCIA — Cores e tipografia
  // ========================================
  aparencia: {
    bg: "#0b0a0c",              // Cor de fundo principal
    accent: "#d4af37",          // Cor de destaque (dourado)
    text: "#eee9e0",            // Cor do texto principal
    accentDark: "#8b6f2c",      // Cor de destaque escura
    border: "#2b272f",          // Cor das bordas
    fontSerif: "'Playfair Display', serif",  // Fonte para títulos
    fontSans: "'Inter', sans-serif"          // Fonte para corpo
  }
};

// ========================================
// EXPORTAÇÃO
// ========================================

// Expõe globalmente para compatibilidade com código existente
window.DEFAULT_CONTENT = DEFAULT_CONTENT;