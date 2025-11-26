# Commande par défaut
all: up

# Démarrer
up:
	docker compose up -d
	@echo "✅ Projet démarré"
	@echo "Frontend: https://app.localhost:8443"
	@echo "API:      https://api.localhost:8443"

# Arrêter
down:
	docker compose down

# Redémarrer
restart:
	docker compose restart

# Logs
logs:
	docker compose logs -f

# Rebuild
build:
	docker compose build --no-cache

# Rebuild et redémarrer
rebuild: down build up

# Nettoyage simple
clean:
	docker compose down -v

# Nettoyage complet
fclean:
	docker compose down -v
	docker system prune -af

# Tout refaire
re: fclean all

# Aide
help:
	@echo "Commandes disponibles:"
	@echo "  make          - Démarre le projet"
	@echo "  make down     - Arrête le projet"
	@echo "  make restart  - Redémarre"
	@echo "  make logs     - Affiche les logs"
	@echo "  make build    - Rebuild les images"
	@echo "  make rebuild  - down + build + up"
	@echo "  make clean    - Nettoie les containers"
	@echo "  make fclean   - Nettoyage complet"
	@echo "  make re       - fclean + all"

.PHONY: all up down restart logs build clean fclean re help