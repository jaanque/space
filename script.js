// Configuración de Spotify API
const clientId = '97d973ea484b40d592cbf2e18ca5fd5c'; // Reemplaza con tu Client ID de Spotify Developer
const redirectUri = window.location.origin + window.location.pathname;
const scope = 'user-top-read user-read-private user-read-email';

// Elementos del DOM
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const loginSection = document.getElementById('login-section');
const museumSection = document.getElementById('museum-section');
const loadingScreen = document.getElementById('loading');
const musicCollageContainer = document.getElementById('music-collage');

// Función para generar una cadena aleatoria para el state
function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

// Manejo del inicio de sesión
loginButton.addEventListener('click', () => {
    const state = generateRandomString(16);
    localStorage.setItem('spotify_auth_state', state);

    const authorizeUrl = 'https://accounts.spotify.com/authorize?' +
        new URLSearchParams({
            response_type: 'token',
            client_id: clientId,
            scope: scope,
            redirect_uri: redirectUri,
            state: state
        }).toString();
    
    window.location = authorizeUrl;
});

// Manejo del cierre de sesión
logoutButton.addEventListener('click', () => {
    localStorage.removeItem('spotify_token');
    localStorage.removeItem('spotify_token_expires');
    showLoginSection();
});

// Mostrar la sección de login
function showLoginSection() {
    loginSection.classList.remove('hidden');
    museumSection.classList.add('hidden');
    loadingScreen.classList.add('hidden');
}

// Mostrar la sección del museo
function showMuseumSection() {
    loginSection.classList.add('hidden');
    museumSection.classList.remove('hidden');
    loadingScreen.classList.add('hidden');
}

// Mostrar/ocultar pantalla de carga
function showLoading(show = false) {
    if (show) {
        loadingScreen.classList.remove('hidden');
    } else {
        loadingScreen.classList.add('hidden');
    }
}

// Obtener token de acceso desde la URL o storage
function getAccessToken() {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const storedToken = localStorage.getItem('spotify_token');
    const storedTokenExpires = localStorage.getItem('spotify_token_expires');
    
    // Si hay un token en la URL
    if (params.has('access_token')) {
        const token = params.get('access_token');
        const expiresIn = params.get('expires_in');
        const state = params.get('state');
        const storedState = localStorage.getItem('spotify_auth_state');
        
        // Verificar el state para seguridad
        if (state === null || state !== storedState) {
            console.error('Error de state en autenticación');
            return null;
        }
        
        // Limpiar state y guardar token
        localStorage.removeItem('spotify_auth_state');
        const expiresAt = Date.now() + (expiresIn * 1000);
        localStorage.setItem('spotify_token', token);
        localStorage.setItem('spotify_token_expires', expiresAt);
        
        // Limpiar la URL
        window.history.replaceState({}, document.title, redirectUri);
        
        return token;
    }
    // Si hay un token almacenado y no ha expirado
    else if (storedToken && storedTokenExpires && Date.now() < parseInt(storedTokenExpires)) {
        return storedToken;
    }
    
    return null;
}

// Realizar solicitud a la API de Spotify
async function fetchFromSpotify(endpoint, token) {
    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    
    if (!response.ok) {
        throw new Error(`Error en solicitud a Spotify: ${response.status}`);
    }
    
    return await response.json();
}

// Obtener tus top tracks
async function getTopTracks(token) {
    try {
        const data = await fetchFromSpotify('/me/top/tracks?limit=12&time_range=medium_term', token);
        return data.items.map(track => ({
            name: track.name,
            image: track.album.images[0].url,
            type: 'track'
        }));
    } catch (error) {
        console.error('Error al obtener top tracks:', error);
        return [];
    }
}

// Obtener tus top artistas
async function getTopArtists(token) {
    try {
        const data = await fetchFromSpotify('/me/top/artists?limit=12&time_range=medium_term', token);
        return data.items.map(artist => ({
            name: artist.name,
            image: artist.images[0].url,
            type: 'artist'
        }));
    } catch (error) {
        console.error('Error al obtener top artistas:', error);
        return [];
    }
}

// Obtener tus top álbumes (derivados de tus top tracks)
async function getTopAlbums(token) {
    try {
        const data = await fetchFromSpotify('/me/top/tracks?limit=30&time_range=medium_term', token);
        
        // Filtrar álbumes únicos
        const uniqueAlbums = [];
        const albumIds = new Set();
        
        data.items.forEach(track => {
            if (!albumIds.has(track.album.id) && uniqueAlbums.length < 12) {
                albumIds.add(track.album.id);
                uniqueAlbums.push({
                    name: track.album.name,
                    image: track.album.images[0].url,
                    type: 'album'
                });
            }
        });
        
        return uniqueAlbums;
    } catch (error) {
        console.error('Error al obtener top álbumes:', error);
        return [];
    }
}

// Función para obtener un número aleatorio en un rango
function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
}

// Crear una cuadrícula para distribuir imágenes uniformemente
function createGrid(containerWidth, containerHeight, numItems) {
    // Determinamos cuántas celdas necesitamos en cada dirección
    // para una distribución aproximadamente cuadrada
    const sqrtItems = Math.ceil(Math.sqrt(numItems));
    const cols = sqrtItems;
    const rows = Math.ceil(numItems / cols);
    
    const cellWidth = containerWidth / cols;
    const cellHeight = containerHeight / rows;
    
    const cells = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (cells.length < numItems) {
                cells.push({
                    x: col * cellWidth,
                    y: row * cellHeight,
                    width: cellWidth,
                    height: cellHeight
                });
            }
        }
    }
    
    // Mezclar las celdas para una distribución más aleatoria
    return cells.sort(() => Math.random() - 0.5);
}

// Mostrar todos los elementos en el collage
function displayInCollage(items) {
    musicCollageContainer.innerHTML = '';
    const containerWidth = musicCollageContainer.offsetWidth;
    const containerHeight = musicCollageContainer.offsetHeight;
    
    // Tamaños variables para las imágenes
    const sizes = [
        { width: 100, height: 100 },
        { width: 120, height: 120 },
        { width: 140, height: 140 },
        { width: 160, height: 160 }
    ];
    
    // Mezclar los elementos para distribuir los tipos
    const shuffledItems = [...items].sort(() => Math.random() - 0.5);
    
    // Crear una cuadrícula para distribuir las imágenes uniformemente
    const grid = createGrid(containerWidth, containerHeight, shuffledItems.length);
    
    // Colocar cada elemento en una celda de la cuadrícula
    shuffledItems.forEach((item, index) => {
        const el = document.createElement('div');
        el.className = 'artwork-item';
        el.style.backgroundImage = `url(${item.image})`;
        el.title = `${item.name} (${item.type})`;
        el.setAttribute('data-type', item.type);
        
        // Seleccionar un tamaño aleatorio
        const size = sizes[Math.floor(Math.random() * sizes.length)];
        el.style.width = `${size.width}px`;
        el.style.height = `${size.height}px`;
        
        const cell = grid[index];
        
        // Posicionar dentro de la celda con algo de variación aleatoria
        // pero asegurando que permanezca dentro de la celda
        const maxOffsetX = Math.max(0, cell.width - size.width - 10);
        const maxOffsetY = Math.max(0, cell.height - size.height - 10);
        
        const offsetX = randomInRange(0, maxOffsetX);
        const offsetY = randomInRange(0, maxOffsetY);
        
        el.style.left = `${cell.x + offsetX}px`;
        el.style.top = `${cell.y + offsetY}px`;
        
        // Rotación aleatoria
        const rotate = randomInRange(-15, 15);
        el.style.setProperty('--random-rotate', `${rotate}deg`);
        el.style.transform = `rotate(${rotate}deg)`;
        
        // Animación con retraso basado en el índice
        el.style.animation = `fadeIn 0.5s ease forwards`;
        el.style.animationDelay = `${index * 0.1}s`;
        el.style.opacity = '0';
        
        // Agregar z-index aleatorio para efecto de profundidad
        el.style.zIndex = Math.floor(randomInRange(1, 10));
        
        musicCollageContainer.appendChild(el);
    });
}

// Cargar los datos de Spotify y mostrarlos
async function loadSpotifyData() {
    const token = getAccessToken();
    
    if (!token) {
        showLoginSection();
        return;
    }
    
    try {
        showLoading(true);
        
        // Obtener datos
        const [tracks, artists, albums] = await Promise.all([
            getTopTracks(token),
            getTopArtists(token),
            getTopAlbums(token)
        ]);
        
        // Combinar todos los elementos en una sola colección
        const allItems = [...tracks, ...artists, ...albums];
        
        // Mostrar todos en el collage
        displayInCollage(allItems);
        
        showMuseumSection();
    } catch (error) {
        console.error('Error al cargar datos:', error);
        alert('Hubo un problema al cargar tus datos de Spotify. Por favor, inténtalo de nuevo.');
        showLoginSection();
    } finally {
        showLoading(false);
    }
}

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM cargado, inicializando aplicación");
    
    // Asegurarse de que la pantalla de carga está oculta inicialmente
    showLoading(false);
    
    // Verificar token y mostrar la sección correspondiente
    const token = getAccessToken();
    if (token) {
        console.log("Token encontrado, cargando datos");
        loadSpotifyData();
    } else {
        console.log("No hay token, mostrando login");
        showLoginSection();
    }
});