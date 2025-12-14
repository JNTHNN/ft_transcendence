all: build up


up:
	docker compose up -d
	@echo "✅ Projet démarré"
	@echo "Frontend: https://app.localhost:8443"
	@echo "API:      https://api.localhost:8443"

down:
	docker compose down


restart:
	docker compose restart


logs:
	docker compose logs -f


build:
	docker compose build --no-cache


rebuild: down build up


clean:
	docker compose down -v

t
fclean:
	docker compose down -v
	docker system prune -af


re: fclean all


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