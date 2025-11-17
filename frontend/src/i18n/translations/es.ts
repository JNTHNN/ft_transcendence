export default {
  nav: {
    home: "INICIO",
    tournaments: "TORNEOS",
    play: "JUGAR",
    chat: "CHAT",
    profile: "PERFIL",
    login: "INICIAR SESIÓN",
    signup: "REGISTRARSE"
  },

  auth: {
    login: "Iniciar Sesión",
    signup: "Registrarse",
    logout: "Cerrar Sesión",
    email: "Correo Electrónico",
    password: "Contraseña",
    displayName: "Nombre para Mostrar",
    confirmPassword: "Confirmar Contraseña",
    loginWith42: "Iniciar sesión con 42",
    alreadyHaveAccount: "¿Ya tienes una cuenta?",
    dontHaveAccount: "¿No tienes una cuenta?",
    loginHere: "Inicia sesión aquí",
    signupHere: "Regístrate aquí",
    loginButton: "Iniciar sesión",
    signupButton: "Registrarse",
    demoMode: "Modo Demo",
    exitDemoMode: "Salir del modo demo",
    demoModeActive: "Conectado en modo demo"
  },

  profile: {
    title: "Mi Perfil",
    editProfile: "Editar Perfil",
    profilePhoto: "Foto de Perfil",
    avatarSyncFrom42: "Avatar sincronizado desde tu perfil 42",
    customAvatar: "Avatar Personalizado",
    oauth42EmailRestriction: "Los usuarios de 42 deben cambiar su correo desde su perfil 42",
    updateProfile: "Actualizar",
    cancel: "Cancelar",
    accountSecurity: "Seguridad de la Cuenta",
    oauth42Account: "Cuenta OAuth de 42",
    oauth42SecurityMessage: "Tu cuenta está protegida por la autenticación de 42. La gestión de contraseñas se hace directamente a través de tu cuenta 42.",
    changePassword: "Cambiar Contraseña",
    currentPassword: "Contraseña Actual",
    newPassword: "Nueva Contraseña",
    confirmNewPassword: "Confirmar Nueva Contraseña",
    dangerZone: "Zona Peligrosa",
    deleteAccount: "Eliminar permanentemente mi cuenta",
    deleteAccountWarning: "Esta acción es irreversible y eliminará permanentemente:",
    deleteAccountItems: {
      profile: "Tu perfil e información personal",
      history: "Todo tu historial de partidas",
      stats: "Tus estadísticas y clasificaciones",
      messages: "Tus mensajes de chat",
      tokens: "Todos tus tokens de conexión"
    },
    oauth42DeleteNote: "Esto solo eliminará tu cuenta de nuestra plataforma, no tu cuenta de 42.",
    deletePasswordConfirm: "Contraseña (para confirmar la eliminación)",
    deleteConfirmation: "Entiendo que esta acción es irreversible y que todos mis datos serán eliminados permanentemente",
    memberSince: "Miembro desde {{date}}",
    lastSync: "Última sincronización 42: {{date}}",
    accountType: "Tipo de cuenta: {{type}}"
  },

  stats: {
    title: "Estadísticas",
    gamesPlayed: "Partidas Jugadas",
    victories: "Victorias",
    defeats: "Derrotas"
  },

  messages: {
    profileUpdated: "¡Perfil actualizado con éxito!",
    passwordChanged: "¡Contraseña cambiada con éxito!",
    accountDeleted: "Tu cuenta ha sido eliminada con éxito.\\nSerás redirigido a la página de inicio.",
    oauth42AccountDeleted: "Cuenta OAuth2 eliminada con éxito. Nota: Esto solo elimina tu cuenta de nuestra plataforma, no de 42.",
    confirmLogout: "¿Estás seguro de que quieres cerrar sesión?",
    confirmDeleteAccount: "¿Estás absolutamente seguro de que quieres eliminar tu cuenta?",
    noChangesDetected: "No se detectaron cambios",
    invalidEmailFormat: "Formato de correo inválido",
    emailAlreadyInUse: "Correo ya en uso",
    displayNameRequired: "El nombre para mostrar no puede estar vacío",
    emailRequired: "El correo no puede estar vacío",
    passwordTooShort: "La nueva contraseña debe contener al menos 6 caracteres",
    passwordsMismatch: "Las contraseñas no coinciden",
    passwordMustDiffer: "La nueva contraseña debe ser diferente de la actual",
    allFieldsRequired: "Por favor completa todos los campos",
    incorrectPassword: "Contraseña incorrecta",
    networkError: "Error de red: {{error}}"
  },

  language: {
    title: "Idioma",
    selectLanguage: "Seleccionar Idioma",
    currentLanguage: "Idioma Actual"
  },

  errors: {
    oauthCallbackFailed: "Falló el inicio de sesión OAuth",
    userNotFound: "Usuario no encontrado",
    unauthorized: "No autorizado",
    invalidToken: "Token inválido",
    missingToken: "Token faltante",
    internalError: "Error interno",
    loginFailed: "Error de conexión",
    networkError: "Error de red"
  },

  game: {
    title: "Partida",
    play: "Jugar",
    waiting: "Esperando un oponente...",
    playerVs: "{player1} vs {player2}",
    score: "Puntuación",
    winner: "Ganador",
    gameOver: "Juego Terminado",
    newGame: "Nueva Partida",
    spectate: "Observar",
    joinGame: "Unirse al Juego",
    startGame: "Iniciar Partida",
    gameInProgress: "Partida en Curso",
    findOpponent: "Buscar Oponente"
  },

  tournament: {
    title: "Torneos",
    tournaments: "Torneos",
    createTournament: "Crear Torneo",
    joinTournament: "Unirse",
    tournamentName: "Nombre del Torneo",
    participants: "Participantes",
    status: "Estado",
    pending: "Pendiente",
    active: "Activo",
    completed: "Completado",
    bracket: "Cuadro",
    round: "Ronda {number}",
    final: "Final",
    semifinals: "Semifinales",
    quarterfinals: "Cuartos de Final",
    availableTournaments: "Torneos Disponibles",
    myTournaments: "Mis Torneos"
  },

  chat: {
    title: "Chat",
    sendMessage: "Enviar Mensaje",
    typeMessage: "Escribe tu mensaje...",
    online: "En línea",
    offline: "Desconectado",
    send: "Enviar",
    emptyChat: "Aún no hay mensajes",
    userJoined: "{user} se unió al chat",
    userLeft: "{user} dejó el chat",
    connecting: "Conectando al chat...",
    disconnected: "Desconectado del chat"
  },

  common: {
    loading: "Cargando...",
    save: "Guardar",
    cancel: "Cancelar",
    delete: "Eliminar",
    edit: "Editar",
    close: "Cerrar",
    confirm: "Confirmar",
    yes: "Sí",
    no: "No",
    back: "Volver",
    next: "Siguiente",
    previous: "Anterior",
    or: "o",
    search: "Buscar",
    filter: "Filtrar",
    sort: "Ordenar",
    refresh: "Actualizar",
    retry: "Reintentar",
    create: "Crear",
    user: "Usuario"
  }
};
