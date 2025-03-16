// Configuración de la API de Spotify
const clientId = 'ba0e68fafbf441958bac79bb94d5412d';
const redirectUri = "http://127.0.0.1:3000/index.html";
const scopes = 'user-top-read user-read-recently-played';

// Estado de la aplicación
let userTopArtists = [];
let userGenres = [];
let constellation = null;
let stars = [];
let connections = [];
let app = null;
let pixiContainer = null;
let hoveredStar = null;

// Elementos DOM
const loginScreen = document.getElementById('login-screen');
const loadingScreen = document.getElementById('loading-screen');
const constellationScreen = document.getElementById('constellation-screen');
const loginButton = document.getElementById('login-button');
const shareButton = document.getElementById('share-button');
const logoutButton = document.getElementById('logout-button');
const tooltip = document.getElementById('tooltip');
const canvas = document.getElementById('constellation-canvas');

// Inicializar la aplicación
function init() {
    // Comprobar si hay un token en la URL (redirección de Spotify)
    const params = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = params.get('access_token');
    
    if (accessToken) {
        // Ya tenemos token, cargar datos
        showScreen(loadingScreen);
        sessionStorage.setItem('spotify_access_token', accessToken);
        loadUserData(accessToken);
        
        // Limpiar URL para evitar que el token quede expuesto
        history.replaceState({}, document.title, redirectUri);
    } else {
        // Comprobar si hay token en sesión
        const storedToken = sessionStorage.getItem('spotify_access_token');
        if (storedToken) {
            showScreen(loadingScreen);
            loadUserData(storedToken);
        } else {
            // Mostrar pantalla de login
            showScreen(loginScreen);
        }
    }
    
    // Event listeners
    loginButton.addEventListener('click', handleLogin);
    shareButton.addEventListener('click', shareConstellation);
    logoutButton.addEventListener('click', handleLogout);
    
    // Responsive handler
    window.addEventListener('resize', handleResize);
}

// Cambiar entre pantallas
function showScreen(screenElement) {
    [loginScreen, loadingScreen, constellationScreen].forEach(screen => {
        screen.classList.remove('active');
    });
    screenElement.classList.add('active');
}

// Iniciar sesión con Spotify
function handleLogin() {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
    window.location.href = authUrl;
}

// Cerrar sesión
function handleLogout() {
    sessionStorage.removeItem('spotify_access_token');
    window.location.href = redirectUri.split('#')[0]; // Eliminar hash de la URL
}

// Cargar datos del usuario desde Spotify
async function loadUserData(token) {
    try {
        // Obtener los artistas más escuchados
        const topResponse = await fetch('https://api.spotify.com/v1/me/top/artists?time_range=medium_term&limit=50', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!topResponse.ok) {
            throw new Error('Error al obtener datos de Spotify');
        }
        
        const topData = await topResponse.json();
        userTopArtists = topData.items;
        
        // Extraer géneros
        const allGenres = new Map();
        userTopArtists.forEach(artist => {
            artist.genres.forEach(genre => {
                if (allGenres.has(genre)) {
                    allGenres.set(genre, allGenres.get(genre) + 1);
                } else {
                    allGenres.set(genre, 1);
                }
            });
        });
        
        // Ordenar géneros por frecuencia
        userGenres = [...allGenres.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(entry => entry[0]);
        
        // Obtener las canciones más escuchadas para cada artista
        await getTopTracksForArtists(token);
        
        // Generar la constelación
        generateConstellation();
        
        // Mostrar la pantalla de constelación
        showScreen(constellationScreen);
        
    } catch (error) {
        console.error('Error cargando datos:', error);
        // Si hay error de autenticación, volver al login
        if (error.message.includes('Error al obtener datos')) {
            sessionStorage.removeItem('spotify_access_token');
            showScreen(loginScreen);
            alert('La sesión ha expirado. Por favor, inicia sesión de nuevo.');
        }
    }
}

// Obtener las canciones más escuchadas para cada artista
async function getTopTracksForArtists(token) {
    // Limitamos a los primeros 20 artistas para no hacer demasiadas peticiones
    const topArtists = userTopArtists.slice(0, 20);
    
    const promises = topArtists.map(async (artist) => {
        try {
            const response = await fetch(`https://api.spotify.com/v1/artists/${artist.id}/top-tracks?market=ES`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                // Añadir la canción más popular al objeto del artista
                if (data.tracks && data.tracks.length > 0) {
                    artist.topTrack = data.tracks[0];
                }
            }
        } catch (err) {
            console.error(`Error obteniendo canciones de ${artist.name}:`, err);
        }
    });
    
    await Promise.all(promises);
}

// Generar datos de la constelación
function generateConstellation() {
    // Crear estrellas para cada artista
    stars = userTopArtists.map((artist, index) => {
        // Posición basada en popularidad e índice
        const radius = Math.min(window.innerWidth, window.innerHeight) * 0.4;
        const angle = (index / userTopArtists.length) * Math.PI * 2;
        
        // Añadir algo de aleatoriedad a la posición
        const distance = radius * (0.5 + Math.random() * 0.5);
        
        // Posiciones finales con centro en la mitad de la pantalla
        const x = window.innerWidth / 2 + Math.cos(angle) * distance;
        const y = window.innerHeight / 2 + Math.sin(angle) * distance;
        
        // Calcular tamaño basado en popularidad (0-100)
        const minSize = 2;
        const maxSize = 12;
        const size = minSize + ((artist.popularity / 100) * (maxSize - minSize));
        
        // Calcular brillo basado en posición en la lista
        const brightness = Math.max(0.3, 1 - (index / 30));
        
        return {
            id: artist.id,
            name: artist.name,
            x,
            y,
            size,
            brightness,
            genres: artist.genres,
            images: artist.images,
            popularity: artist.popularity,
            topTrack: artist.topTrack,
            // Para animación
            pulsatePhase: Math.random() * Math.PI * 2,
            twinkleSpeed: 0.5 + Math.random() * 0.5
        };
    });
    
    // Generar conexiones entre estrellas basadas en géneros similares
    connections = [];
    
    stars.forEach((star1, i) => {
        stars.slice(i + 1).forEach(star2 => {
            // Verificar si comparten al menos un género
            const sharedGenres = star1.genres.filter(genre => star2.genres.includes(genre));
            
            if (sharedGenres.length > 0) {
                // Crear una conexión con intensidad basada en géneros compartidos
                const intensity = Math.min(1, sharedGenres.length / 3);
                connections.push({
                    star1: i,
                    star2: stars.indexOf(star2),
                    intensity,
                    sharedGenres
                });
            }
        });
    });
    
    // Inicializar visualización PixiJS
    initializePixiApp();
}

// Inicializar la aplicación PixiJS
function initializePixiApp() {
    // Crear aplicación PixiJS
    app = new PIXI.Application({
        view: canvas,
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: 0x000000,
        resolution: window.devicePixelRatio || 1,
        antialias: true,
        autoDensity: true
    });
    
    // Crear contenedor principal
    pixiContainer = new PIXI.Container();
    app.stage.addChild(pixiContainer);
    
    // Crear nebulosa de fondo
    createNebula();
    
    // Dibujar conexiones
    drawConnections();
    
    // Dibujar estrellas
    drawStars();
    
    // Configurar interacciones
    setupInteractions();
    
    // Iniciar animación
    app.ticker.add(animate);
}

// Crear efecto de nebulosa
function createNebula() {
    const nebula = new PIXI.Graphics();
    nebula.alpha = 0.05;
    
    // Dibujar múltiples gradientes para simular nebulosa
    const colors = [
        0x8862fc, // Púrpura
        0x5628ee, // Índigo
        0x3b82f6  // Azul
    ];
    
    for (let i = 0; i < 5; i++) {
        const color = colors[i % colors.length];
        const x = Math.random() * app.screen.width;
        const y = Math.random() * app.screen.height;
        const radius = Math.random() * 300 + 200;
        
        // Crear un gradiente radial
        nebula.beginFill(color, 0.4);
        nebula.drawCircle(x, y, radius);
        nebula.endFill();
    }
    
    // Aplicar filtro de desenfoque
    const blurFilter = new PIXI.filters.BlurFilter();
    blurFilter.blur = 60;
    nebula.filters = [blurFilter];
    
    pixiContainer.addChild(nebula);
}

// Dibujar conexiones entre estrellas
function drawConnections() {
    const connectionsGraphic = new PIXI.Graphics();
    pixiContainer.addChild(connectionsGraphic);
    
    connections.forEach(conn => {
        const star1 = stars[conn.star1];
        const star2 = stars[conn.star2];
        
        // Calcular color basado en géneros compartidos
        let color = 0x7e5bef; // Color predeterminado
        
        connectionsGraphic.lineStyle({
            width: 1 + conn.intensity * 2,
            color,
            alpha: 0.3 + conn.intensity * 0.2,
            join: PIXI.LINE_JOIN.ROUND,
            cap: PIXI.LINE_CAP.ROUND
        });
        
        connectionsGraphic.moveTo(star1.x, star1.y);
        connectionsGraphic.lineTo(star2.x, star2.y);
    });
}

// Dibujar estrellas
function drawStars() {
    stars.forEach(star => {
        // Crear contenedor para cada estrella
        const starContainer = new PIXI.Container();
        starContainer.x = star.x;
        starContainer.y = star.y;
        star.container = starContainer;
        
        // Crear gráfico para la estrella
        const starGraphic = new PIXI.Graphics();
        starGraphic.beginFill(0xFFFFFF, star.brightness);
        starGraphic.drawCircle(0, 0, star.size);
        
        // Agregar resplandor
        const glowSize = star.size * 2;
        const glow = new PIXI.Graphics();
        glow.beginFill(0xFFFFFF, 0.2);
        glow.drawCircle(0, 0, glowSize);
        glow.endFill();
        
        // Aplicar filtro de desenfoque al resplandor
        const blurFilter = new PIXI.filters.BlurFilter();
        blurFilter.blur = 5;
        glow.filters = [blurFilter];
        
        // Añadir identificador para interacciones
        starGraphic.eventMode = 'static';
        starGraphic.cursor = 'pointer';
        starGraphic.name = star.id;
        
        // Añadir interactividad
        starGraphic.on('mouseover', () => onStarHover(star));
        starGraphic.on('mouseout', () => onStarLeave(star));
        starGraphic.on('click', () => onStarClick(star));
        
        // Agregar capas al contenedor
        starContainer.addChild(glow);
        starContainer.addChild(starGraphic);
        
        // Almacenar referencia al gráfico
        star.graphic = starGraphic;
        star.glow = glow;
        
        // Añadir a la escena
        pixiContainer.addChild(starContainer);
    });
}

// Configurar interacciones
function setupInteractions() {
    // Evento para el movimiento del mouse (tooltip)
    app.view.addEventListener('mousemove', (e) => {
        if (hoveredStar) {
            tooltip.style.left = `${e.clientX + 15}px`;
            tooltip.style.top = `${e.clientY + 15}px`;
        }
    });
}

// Función de animación
function animate(delta) {
    stars.forEach(star => {
        // Animación de pulsación
        star.pulsatePhase += delta * 0.02 * star.twinkleSpeed;
        const pulseFactor = 0.9 + Math.sin(star.pulsatePhase) * 0.1;
        
        // Aplicar pulsación
        star.graphic.scale.set(pulseFactor);
        star.glow.scale.set(pulseFactor * 1.2);
        
        // Ajustar brillo
        const brightnessVariation = 0.85 + Math.sin(star.pulsatePhase) * 0.15;
        star.graphic.alpha = star.brightness * brightnessVariation;
        star.glow.alpha = 0.2 * brightnessVariation;
    });
}

// Eventos de interacción
function onStarHover(star) {
    hoveredStar = star;
    
    // Mostrar tooltip
    tooltip.innerHTML = `
        <h4>${star.name}</h4>
        <p>Popularidad: ${star.popularity}/100</p>
        ${star.topTrack ? `<p>Canción más popular: ${star.topTrack.name}</p>` : ''}
        <p>Géneros: ${star.genres.slice(0, 3).join(', ')}</p>
    `;
    tooltip.style.opacity = '1';
    
    // Resaltar la estrella
    star.graphic.tint = 0x8862fc;
    star.container.scale.set(1.2);
    star.glow.alpha = 0.5;
    
    // Resaltar conexiones
    highlightConnections(star);
}

function onStarLeave(star) {
    hoveredStar = null;
    
    // Ocultar tooltip
    tooltip.style.opacity = '0';
    
    // Restablecer estrella
    star.graphic.tint = 0xFFFFFF;
    star.container.scale.set(1);
    star.glow.alpha = 0.2;
    
    // Restablecer conexiones
    resetConnections();
}

function onStarClick(star) {
    // Abrir perfil de artista en Spotify
    if (star.externalUrl) {
        window.open(star.externalUrl, '_blank');
    }
}

// Resaltar conexiones con una estrella
function highlightConnections(star) {
    const starIndex = stars.indexOf(star);
    
    // Resetear todas las conexiones
    resetConnections();
    
    // Buscar conexiones relacionadas
    connections.forEach((conn, index) => {
        if (conn.star1 === starIndex || conn.star2 === starIndex) {
            // Resaltar esta conexión
            const connGraphic = pixiContainer.children[1]; // La gráfica de conexiones
            
            // Redibujar esta conexión con mayor intensidad
            const otherStarIndex = conn.star1 === starIndex ? conn.star2 : conn.star1;
            const otherStar = stars[otherStarIndex];
            
            // Resaltar la otra estrella conectada
            otherStar.container.scale.set(1.1);
            otherStar.glow.alpha = 0.4;
            
            // Dibujar línea de conexión resaltada
            const highlight = new PIXI.Graphics();
            highlight.lineStyle({
                width: 2 + conn.intensity * 3,
                color: 0x8862fc,
                alpha: 0.7,
                join: PIXI.LINE_JOIN.ROUND,
                cap: PIXI.LINE_CAP.ROUND
            });
            
            highlight.moveTo(star.x, star.y);
            highlight.lineTo(otherStar.x, otherStar.y);
            
            // Añadir temporalmente
            pixiContainer.addChild(highlight);
            conn.highlight = highlight;
        }
    });
}

// Resetear todas las conexiones a su estado normal
function resetConnections() {
    connections.forEach(conn => {
        if (conn.highlight) {
            pixiContainer.removeChild(conn.highlight);
            conn.highlight = null;
        }
        
        // Resetear estado de las estrellas
        const star1 = stars[conn.star1];
        const star2 = stars[conn.star2];
        
        if (star1 !== hoveredStar) {
            star1.container.scale.set(1);
            star1.glow.alpha = 0.2;
        }
        
        if (star2 !== hoveredStar) {
            star2.container.scale.set(1);
            star2.glow.alpha = 0.2;
        }
    });
}

// Función para compartir la constelación
function shareConstellation() {
    // Crear una imagen de la constelación para compartir
    const renderTexture = PIXI.RenderTexture.create({
        width: app.screen.width,
        height: app.screen.height
    });
    
    app.renderer.render(pixiContainer, renderTexture);
    
    // Convertir la textura renderizada en una URL de datos
    const img = app.renderer.plugins.extract.image(renderTexture);
    
    // Intentar compartir la imagen (API Web Share si está disponible)
    if (navigator.share) {
        // Convertir la imagen a un blob
        fetch(img.src)
            .then(res => res.blob())
            .then(blob => {
                const file = new File([blob], 'mi-universo-musical.png', { type: 'image/png' });
                
                navigator.share({
                    title: 'Mi Universo Musical',
                    text: 'Mira mi universo musical personalizado basado en mis artistas favoritos de Spotify',
                    files: [file]
                }).catch(console.error);
            });
    } else {
        // Fallback: abrir en una nueva ventana o descargar
        const link = document.createElement('a');
        link.download = 'mi-universo-musical.png';
        link.href = img.src;
        link.click();
    }
}

// Manejar cambios de tamaño de ventana
function handleResize() {
    if (app) {
        // Ajustar el tamaño del renderer
        app.renderer.resize(window.innerWidth, window.innerHeight);
        
        // Si ya se ha generado la constelación, regenerarla
        if (stars.length > 0) {
            // Limpiar escena actual
            while (pixiContainer.children.length > 0) {
                pixiContainer.removeChild(pixiContainer.children[0]);
            }
            
            // Recalcular posiciones
            stars.forEach((star, index) => {
                const radius = Math.min(window.innerWidth, window.innerHeight) * 0.4;
                const angle = (index / userTopArtists.length) * Math.PI * 2;
                const distance = radius * (0.5 + Math.random() * 0.5);
                
                star.x = window.innerWidth / 2 + Math.cos(angle) * distance;
                star.y = window.innerHeight / 2 + Math.sin(angle) * distance;
            });
            
            // Redibujar todo
            createNebula();
            drawConnections();
            drawStars();
        }
    }
}

// Funciones para la creación de estrellas aleatorias en el fondo
function createBackgroundStars() {
    const bgStars = new PIXI.Graphics();
    bgStars.alpha = 0.5;
    
    for (let i = 0; i < 100; i++) {
        const x = Math.random() * app.screen.width;
        const y = Math.random() * app.screen.height;
        const size = Math.random() * 1.5 + 0.5;
        
        bgStars.beginFill(0xFFFFFF, Math.random() * 0.5 + 0.3);
        bgStars.drawCircle(x, y, size);
        bgStars.endFill();
    }
    
    pixiContainer.addChild(bgStars);
}

// Función para generar un color basado en el género
function getGenreColor(genre) {
    // Mapa de colores para géneros comunes
    const genreColors = {
        'pop': 0xFF9999,
        'rock': 0xCC3333,
        'hip hop': 0x9933CC,
        'rap': 0x6644CC,
        'electronic': 0x33CCCC,
        'dance': 0x33AAFF,
        'indie': 0x66CC99,
        'alternative': 0x99CC33,
        'r&b': 0xCC6699,
        'jazz': 0xFFCC66,
        'classical': 0xFFFFCC,
        'metal': 0x666666,
        'latin': 0xFF9966,
        'folk': 0xCC9966,
        'reggae': 0x66CC33
    };
    
    // Devolver color específico o un color generado
    if (genreColors[genre.toLowerCase()]) {
        return genreColors[genre.toLowerCase()];
    }
    
    // Generar un color basado en el string
    let hash = 0;
    for (let i = 0; i < genre.length; i++) {
        hash = genre.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return parseInt('0x' + ('00000'.substring(0, 6 - c.length) + c));
}

// Función para animar la transición entre pantallas
function animateTransition(fromScreen, toScreen) {
    fromScreen.style.opacity = '0';
    
    setTimeout(() => {
        showScreen(toScreen);
        toScreen.style.opacity = '0';
        
        setTimeout(() => {
            toScreen.style.opacity = '1';
        }, 10);
    }, 500);
}

// Función para generar una paleta de colores única para el usuario
function generateUserColorPalette() {
    // Generar colores basados en los géneros principales del usuario
    const palette = [];
    
    for (let i = 0; i < Math.min(5, userGenres.length); i++) {
        palette.push(getGenreColor(userGenres[i]));
    }
    
    // Si hay menos de 5 colores, añadir colores complementarios
    while (palette.length < 5) {
        const baseColor = palette[0];
        const r = (baseColor >> 16) & 255;
        const g = (baseColor >> 8) & 255;
        const b = baseColor & 255;
        
        // Color complementario
        const complementary = ((255 - r) << 16) | ((255 - g) << 8) | (255 - b);
        palette.push(complementary);
    }
    
    return palette;
}

// Función para verificar si un token es válido
async function isTokenValid(token) {
    try {
        const response = await fetch('https://api.spotify.com/v1/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        return response.ok;
    } catch (error) {
        return false;
    }
}

// Iniciar la aplicación cuando se carga la página
window.addEventListener('DOMContentLoaded', init);