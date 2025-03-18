// Configuración de Spotify API
const clientId = '97d973ea484b40d592cbf2e18ca5fd5c'; // Reemplazar con tu Client ID de Spotify
const redirectUri = window.location.origin + window.location.pathname;
const scope = 'user-top-read user-read-recently-played';

// Elementos DOM
const loginScreen = document.getElementById('login-screen');
const museumScreen = document.getElementById('museum-screen');
const loginButton = document.getElementById('login-button');
const shareButton = document.getElementById('share-button');
const paintingContent = document.querySelector('.painting-content');
const shareOverlay = document.getElementById('share-overlay');
const shareImage = document.getElementById('share-image');
const cancelShareButton = document.getElementById('cancel-share');
const confirmShareButton = document.getElementById('confirm-share');

// Función para generar un string aleatorio para state
function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

// Iniciar sesión con Spotify
loginButton.addEventListener('click', () => {
    const state = generateRandomString(16);
    localStorage.setItem('spotify_auth_state', state);

    const authorizeUrl = 'https://accounts.spotify.com/authorize';
    const params = new URLSearchParams({
        response_type: 'token',
        client_id: clientId,
        scope: scope,
        redirect_uri: redirectUri,
        state: state,
        show_dialog: true
    });

    window.location = `${authorizeUrl}?${params.toString()}`;
});

// Comprobar si el usuario está volviendo de la autenticación
window.addEventListener('load', () => {
    const hash = window.location.hash.substring(1);
    
    if (hash) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const state = params.get('state');
        const storedState = localStorage.getItem('spotify_auth_state');

        if (accessToken && (state === null || state === storedState)) {
            // Limpiar la URL
            window.history.pushState("", document.title, window.location.pathname);
            
            // Guardar el token y mostrar el museo
            localStorage.setItem('spotify_access_token', accessToken);
            showMuseum(accessToken);
        }
    } else if (localStorage.getItem('spotify_access_token')) {
        // Si ya tenemos un token guardado, mostrar el museo directamente
        showMuseum(localStorage.getItem('spotify_access_token'));
    }
});

// Mostrar la pantalla del museo y cargar los datos
async function showMuseum(token) {
    try {
        // Obtener datos de Spotify
        const [recentTracks, topTracks, topArtists, topAlbums] = await Promise.all([
            getRecentlyPlayed(token),
            getTopItems(token, 'tracks'),
            getTopItems(token, 'artists'),
            getTopAlbums(token)
        ]);

        // Crear un array con todas las imágenes que queremos mostrar
        const allCovers = [
            ...recentTracks.map(track => ({
                image: track.track.album.images[0].url,
                type: 'reciente'
            })),
            ...topTracks.map(track => ({
                image: track.album.images[0].url,
                type: 'top-track'
            })),
            ...topArtists.filter(artist => artist.images && artist.images.length > 0).map(artist => ({
                image: artist.images[0].url,
                type: 'artista'
            })),
            ...topAlbums.map(album => ({
                image: album.images[0].url,
                type: 'album'
            }))
        ];

        // Limitamos la cantidad de portadas para que no sobrecargue la visualización
        const limitedCovers = allCovers.slice(0, 25);
        
        // Mostrar las portadas en el cuadro
        displayCovers(limitedCovers);
        
        // Cambiar a la pantalla del museo
        loginScreen.classList.add('hidden');
        museumScreen.classList.remove('hidden');
    } catch (error) {
        console.error('Error al cargar datos de Spotify:', error);
        alert('Ha ocurrido un error al cargar tus datos de Spotify. Por favor, intenta de nuevo.');
    }
}

// Obtener canciones reproducidas recientemente
async function getRecentlyPlayed(token) {
    const response = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=10', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
        throw new Error('Error al obtener canciones recientes');
    }
    
    const data = await response.json();
    return data.items;
}

// Obtener elementos top (canciones o artistas)
async function getTopItems(token, type) {
    const response = await fetch(`https://api.spotify.com/v1/me/top/${type}?time_range=medium_term&limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
        throw new Error(`Error al obtener top ${type}`);
    }
    
    const data = await response.json();
    return data.items;
}

// Obtener álbumes top (a partir de las canciones top)
async function getTopAlbums(token) {
    const topTracks = await getTopItems(token, 'tracks');
    
    // Extraer albums únicos de las canciones top
    const uniqueAlbums = [];
    const albumIds = new Set();
    
    for (const track of topTracks) {
        if (!albumIds.has(track.album.id)) {
            albumIds.add(track.album.id);
            uniqueAlbums.push(track.album);
        }
    }
    
    return uniqueAlbums;
}

// Mostrar las portadas en el cuadro con distribución corregida por todo el marco
function displayCovers(covers) {
    // Primero aseguramos que el contenedor tenga una posición relativa
    paintingContent.style.position = 'relative';
    
    // Esperar a que el contenedor tenga dimensiones reales
    setTimeout(() => {
        // Obtener dimensiones reales del contenedor
        const containerWidth = paintingContent.offsetWidth;
        const containerHeight = paintingContent.offsetHeight;
        
        console.log(`Dimensiones del contenedor: ${containerWidth}x${containerHeight}`);
        
        if (containerWidth === 0 || containerHeight === 0) {
            console.error("El contenedor no tiene dimensiones definidas");
            // Usar dimensiones fijas si no podemos obtener las reales
            displayCoversWithFixedSize(covers, 800, 600);
            return;
        }
        
        // Limpiar el contenido existente
        paintingContent.innerHTML = '';
        
        // Tamaños variables para las portadas
        const sizes = [80, 100, 120, 150];
        
        // Crear una cuadrícula uniforme para distribuir las portadas
        const gridRows = 5;
        const gridCols = 5;
        
        // Calcular coordenadas específicas para cada posición de la cuadrícula
        const positions = [];
        
        for (let row = 0; row < gridRows; row++) {
            for (let col = 0; col < gridCols; col++) {
                // Calcular posición con margen para no pegar completamente a los bordes
                const margin = 20;
                const cellWidth = (containerWidth - (2 * margin)) / gridCols;
                const cellHeight = (containerHeight - (2 * margin)) / gridRows;
                
                // La posición base es el centro de cada celda de la cuadrícula
                const baseX = margin + (col * cellWidth) + (cellWidth / 2);
                const baseY = margin + (row * cellHeight) + (cellHeight / 2);
                
                // Añadir algo de aleatoriedad, pero limitada para mantener la estructura
                const randomOffsetX = (Math.random() - 0.5) * (cellWidth * 0.5);
                const randomOffsetY = (Math.random() - 0.5) * (cellHeight * 0.5);
                
                positions.push({
                    x: baseX + randomOffsetX,
                    y: baseY + randomOffsetY
                });
            }
        }
        
        // Mezclar las posiciones para que no haya un patrón evidente
        shuffleArray(positions);
        
        // Limitar el número de portadas si es necesario
        const numCovers = Math.min(covers.length, positions.length);
        
        // Colocar cada portada en su posición correspondiente
        for (let i = 0; i < numCovers; i++) {
            const cover = covers[i];
            const position = positions[i];
            const size = sizes[Math.floor(Math.random() * sizes.length)];
            
            // Crear el elemento para la portada
            const coverElement = document.createElement('div');
            coverElement.className = 'album-cover';
            coverElement.style.width = `${size}px`;
            coverElement.style.height = `${size}px`;
            
            // Centrar la portada en la posición calculada
            coverElement.style.left = `${position.x - (size / 2)}px`;
            coverElement.style.top = `${position.y - (size / 2)}px`;
            
            // Rotación aleatoria para dar efecto de collage
            const rotation = Math.floor(Math.random() * 30) - 15; // Entre -15 y 15 grados
            coverElement.style.transform = `rotate(${rotation}deg)`;
            
            // Imagen de la portada
            const img = document.createElement('img');
            img.src = cover.image;
            img.alt = `Portada ${cover.type}`;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            
            coverElement.appendChild(img);
            paintingContent.appendChild(coverElement);
        }
        
    }, 100); // Pequeño retraso para asegurar que el DOM esté listo
}

// Función alternativa con dimensiones fijas si no podemos obtener las dimensiones reales
function displayCoversWithFixedSize(covers, width, height) {
    // Limpiar el contenido existente
    paintingContent.innerHTML = '';
    
    // Establecer dimensiones fijas al contenedor
    paintingContent.style.width = `${width}px`;
    paintingContent.style.height = `${height}px`;
    
    // Tamaños variables para las portadas
    const sizes = [80, 100, 120, 150];
    
    // Distribuir las portadas en posiciones específicas para cubrir todo el marco
    const positions = [
        // Esquinas
        { x: 50, y: 50 },                    // Superior izquierda
        { x: width - 50, y: 50 },            // Superior derecha
        { x: 50, y: height - 50 },           // Inferior izquierda
        { x: width - 50, y: height - 50 },   // Inferior derecha
        
        // Bordes
        { x: width / 2, y: 50 },             // Superior centro
        { x: width / 2, y: height - 50 },    // Inferior centro
        { x: 50, y: height / 2 },            // Izquierda centro
        { x: width - 50, y: height / 2 },    // Derecha centro
        
        // Centros de cuadrantes
        { x: width / 4, y: height / 4 },     // Cuadrante superior izquierdo
        { x: width * 3/4, y: height / 4 },   // Cuadrante superior derecho
        { x: width / 4, y: height * 3/4 },   // Cuadrante inferior izquierdo
        { x: width * 3/4, y: height * 3/4 }, // Cuadrante inferior derecho
        
        // Centro
        { x: width / 2, y: height / 2 },
        
        // Posiciones adicionales distribuidas
        { x: width / 3, y: height / 3 },
        { x: width * 2/3, y: height / 3 },
        { x: width / 3, y: height * 2/3 },
        { x: width * 2/3, y: height * 2/3 },
        
        // Más posiciones para cubrir el espacio
        { x: width / 6, y: height / 2 },
        { x: width * 5/6, y: height / 2 },
        { x: width / 2, y: height / 6 },
        { x: width / 2, y: height * 5/6 },
        
        // Posiciones adicionales
        { x: width / 4, y: height / 2 },
        { x: width * 3/4, y: height / 2 },
        { x: width / 2, y: height / 4 },
        { x: width / 2, y: height * 3/4 }
    ];
    
    // Añadir variación aleatoria a las posiciones
    positions.forEach(pos => {
        pos.x += (Math.random() - 0.5) * 40;
        pos.y += (Math.random() - 0.5) * 40;
    });
    
    // Mezclar las posiciones para que no haya un patrón evidente
    shuffleArray(positions);
    
    // Limitar el número de portadas si es necesario
    const numCovers = Math.min(covers.length, positions.length);
    
    // Colocar cada portada en su posición correspondiente
    for (let i = 0; i < numCovers; i++) {
        const cover = covers[i];
        const position = positions[i];
        const size = sizes[Math.floor(Math.random() * sizes.length)];
        
        // Crear el elemento para la portada
        const coverElement = document.createElement('div');
        coverElement.className = 'album-cover';
        coverElement.style.width = `${size}px`;
        coverElement.style.height = `${size}px`;
        
        // Centrar la portada en la posición calculada
        coverElement.style.left = `${position.x - (size / 2)}px`;
        coverElement.style.top = `${position.y - (size / 2)}px`;
        
        // Rotación aleatoria para dar efecto de collage
        const rotation = Math.floor(Math.random() * 30) - 15; // Entre -15 y 15 grados
        coverElement.style.transform = `rotate(${rotation}deg)`;
        
        // Imagen de la portada
        const img = document.createElement('img');
        img.src = cover.image;
        img.alt = `Portada ${cover.type}`;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        
        coverElement.appendChild(img);
        paintingContent.appendChild(coverElement);
    }
}

// Función auxiliar para mezclar un array aleatoriamente (algoritmo Fisher-Yates)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Función para compartir el cuadro
shareButton.addEventListener('click', async () => {
    try {
        const paintingElement = document.querySelector('.frame');
        
        // Configurar opciones para html2canvas
        const options = {
            backgroundColor: '#121212',
            width: 1080,
            height: 1920,
            scale: 2, // Mejorar la calidad
        };
        
        // Crear el canvas con html2canvas
        const canvas = await html2canvas(paintingElement, options);
        
        // Mostrar la previsualización en el overlay
        shareImage.src = canvas.toDataURL('image/png');
        shareOverlay.classList.remove('hidden');
        
        // Guardar la referencia al canvas para compartir
        shareOverlay.dataset.canvas = canvas.toDataURL('image/png');
    } catch (error) {
        console.error('Error al generar la imagen:', error);
        alert('Ha ocurrido un error al generar la imagen. Por favor, intenta de nuevo.');
    }
});

// Cancelar compartir
cancelShareButton.addEventListener('click', () => {
    shareOverlay.classList.add('hidden');
});

// Confirmar compartir
confirmShareButton.addEventListener('click', async () => {
    try {
        const dataUrl = shareOverlay.dataset.canvas;
        
        // Convertir dataURL a Blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        
        // Compartir usando la Web Share API si está disponible
        if (navigator.share) {
            await navigator.share({
                files: [new File([blob], 'museo-musical.png', { type: 'image/png' })],
                title: 'Mi Museo Musical',
                text: 'Mira mi museo musical basado en mi actividad en Spotify. Visita nam3.es para crear el tuyo.'
            });
        } else {
            // Fallback para navegadores que no soportan Web Share API
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = 'museo-musical.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        
        // Ocultar el overlay
        shareOverlay.classList.add('hidden');
    } catch (error) {
        console.error('Error al compartir la imagen:', error);
        alert('Ha ocurrido un error al compartir la imagen. Por favor, intenta de nuevo.');
    }
});