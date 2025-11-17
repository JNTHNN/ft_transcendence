export default {
  nav: {
    home: "STARTSEITE",
    tournaments: "TURNIERE",
    play: "SPIELEN",
    chat: "CHAT",
    profile: "PROFIL",
    login: "ANMELDEN",
    signup: "REGISTRIEREN"
  },

  auth: {
    login: "Anmelden",
    signup: "Registrieren",
    logout: "Abmelden",
    email: "E-Mail",
    password: "Passwort",
    displayName: "Anzeigename",
    confirmPassword: "Passwort bestätigen",
    loginWith42: "Mit 42 anmelden",
    alreadyHaveAccount: "Haben Sie bereits ein Konto?",
    dontHaveAccount: "Haben Sie noch kein Konto?",
    loginHere: "Hier anmelden",
    signupHere: "Hier registrieren",
    loginButton: "Anmelden",
    signupButton: "Registrieren",
    demoMode: "Demo-Modus",
    exitDemoMode: "Demo-Modus verlassen",
    demoModeActive: "Im Demo-Modus verbunden"
  },

  profile: {
    title: "Mein Profil",
    editProfile: "Profil bearbeiten",
    profilePhoto: "Profilbild",
    avatarSyncFrom42: "Avatar synchronisiert von Ihrem 42-Profil",
    customAvatar: "Benutzerdefinierter Avatar",
    oauth42EmailRestriction: "42-Benutzer müssen ihre E-Mail über ihr 42-Profil ändern",
    updateProfile: "Aktualisieren",
    cancel: "Abbrechen",
    accountSecurity: "Kontosicherheit",
    oauth42Account: "42 OAuth-Konto",
    oauth42SecurityMessage: "Ihr Konto ist durch 42-Authentifizierung gesichert. Die Passwortverwaltung erfolgt direkt über Ihr 42-Konto.",
    changePassword: "Passwort ändern",
    currentPassword: "Aktuelles Passwort",
    newPassword: "Neues Passwort",
    confirmNewPassword: "Neues Passwort bestätigen",
    dangerZone: "Gefahrenzone",
    deleteAccount: "Mein Konto dauerhaft löschen",
    deleteAccountWarning: "Diese Aktion ist unwiderruflich und löscht dauerhaft:",
    deleteAccountItems: {
      profile: "Ihr Profil und persönliche Informationen",
      history: "Ihre gesamte Spielhistorie",
      stats: "Ihre Statistiken und Ranglisten",
      messages: "Ihre Chat-Nachrichten",
      tokens: "Alle Ihre Verbindungstoken"
    },
    oauth42DeleteNote: "Dies entfernt nur Ihr Konto von unserer Plattform, nicht Ihr 42-Konto.",
    deletePasswordConfirm: "Passwort (zur Bestätigung der Löschung)",
    deleteConfirmation: "Ich verstehe, dass diese Aktion unwiderruflich ist und alle meine Daten dauerhaft gelöscht werden",
    memberSince: "Mitglied seit {{date}}",
    lastSync: "Letzte 42-Synchronisation: {{date}}",
    accountType: "Kontotyp: {{type}}"
  },

  stats: {
    title: "Statistiken",
    gamesPlayed: "Gespielte Spiele",
    victories: "Siege",
    defeats: "Niederlagen"
  },

  messages: {
    profileUpdated: "Profil erfolgreich aktualisiert!",
    passwordChanged: "Passwort erfolgreich geändert!",
    accountDeleted: "Ihr Konto wurde erfolgreich gelöscht.\\nSie werden zur Startseite weitergeleitet.",
    oauth42AccountDeleted: "OAuth2-Konto erfolgreich gelöscht. Hinweis: Dies entfernt nur Ihr Konto von unserer Plattform, nicht von 42.",
    confirmLogout: "Sind Sie sicher, dass Sie sich abmelden möchten?",
    confirmDeleteAccount: "Sind Sie absolut sicher, dass Sie Ihr Konto löschen möchten?",
    noChangesDetected: "Keine Änderungen erkannt",
    invalidEmailFormat: "Ungültiges E-Mail-Format",
    emailAlreadyInUse: "E-Mail bereits verwendet",
    displayNameRequired: "Anzeigename darf nicht leer sein",
    emailRequired: "E-Mail darf nicht leer sein",
    passwordTooShort: "Das neue Passwort muss mindestens 6 Zeichen enthalten",
    passwordsMismatch: "Passwörter stimmen nicht überein",
    passwordMustDiffer: "Das neue Passwort muss sich vom aktuellen unterscheiden",
    allFieldsRequired: "Bitte füllen Sie alle Felder aus",
    incorrectPassword: "Falsches Passwort",
    networkError: "Netzwerkfehler: {{error}}"
  },

  language: {
    title: "Sprache",
    selectLanguage: "Sprache auswählen",
    currentLanguage: "Aktuelle Sprache"
  },

  errors: {
    oauthCallbackFailed: "OAuth-Anmeldung fehlgeschlagen",
    userNotFound: "Benutzer nicht gefunden",
    unauthorized: "Nicht berechtigt",
    invalidToken: "Ungültiger Token",
    missingToken: "Fehlender Token",
    internalError: "Interner Fehler",
    loginFailed: "Anmeldung fehlgeschlagen",
    networkError: "Netzwerkfehler"
  },

  game: {
    title: "Spiel",
    play: "Spielen",
    waiting: "Warte auf einen Gegner...",
    playerVs: "{player1} vs {player2}",
    score: "Punktzahl",
    winner: "Gewinner",
    gameOver: "Spiel Beendet",
    newGame: "Neues Spiel",
    spectate: "Zuschauen",
    joinGame: "Spiel Beitreten",
    startGame: "Spiel Starten",
    gameInProgress: "Spiel Läuft",
    findOpponent: "Gegner Finden"
  },

  tournament: {
    title: "Turniere",
    tournaments: "Turniere",
    createTournament: "Turnier Erstellen",
    joinTournament: "Beitreten",
    tournamentName: "Turniername",
    participants: "Teilnehmer",
    status: "Status",
    pending: "Ausstehend",
    active: "Aktiv",
    completed: "Abgeschlossen",
    bracket: "Turnierbaum",
    round: "Runde {number}",
    final: "Finale",
    semifinals: "Halbfinale",
    quarterfinals: "Viertelfinale",
    availableTournaments: "Verfügbare Turniere",
    myTournaments: "Meine Turniere"
  },

  chat: {
    title: "Chat",
    sendMessage: "Nachricht Senden",
    typeMessage: "Nachricht eingeben...",
    online: "Online",
    offline: "Offline",
    send: "Senden",
    emptyChat: "Noch keine Nachrichten",
    userJoined: "{user} ist dem Chat beigetreten",
    userLeft: "{user} hat den Chat verlassen",
    connecting: "Verbinde mit Chat...",
    disconnected: "Vom Chat getrennt"
  },

  common: {
    loading: "Laden...",
    save: "Speichern",
    cancel: "Abbrechen",
    delete: "Löschen",
    edit: "Bearbeiten",
    close: "Schließen",
    confirm: "Bestätigen",
    yes: "Ja",
    no: "Nein",
    back: "Zurück",
    next: "Weiter",
    previous: "Vorherige",
    or: "oder",
    search: "Suchen",
    filter: "Filtern",
    sort: "Sortieren",
    refresh: "Aktualisieren",
    retry: "Erneut versuchen",
    create: "Erstellen",
    user: "Benutzer"
  }
};
