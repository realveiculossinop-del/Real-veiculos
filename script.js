// ==========================================================================
// CONFIGURAÇÕES DE AUTENTICAÇÃO
// ==========================================================================
const ADMIN_PASSWORD = "real123"; // Defina aqui a sua palavra-passe de admin
let isAdminLoggedIn = false;

// ==========================================================================
// BASE DE DADOS (INDEXEDDB)
// ==========================================================================
const DB_NAME = 'RealVeiculosDB';
const DB_VERSION = 1;
const STORE_NAME = 'veiculos';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function getAllCarsFromDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveCarToDB(car) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(car);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function deleteCarFromDB(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ==========================================================================
// DADOS E VARIÁVEIS DE ESTADO
// ==========================================================================
let cars = [];

// Elementos do DOM
const carGrid = document.getElementById('car-grid');
const adminSection = document.getElementById('admin-section');
const adminToggleBtn = document.getElementById('admin-toggle-btn');
const closeAdminBtn = document.getElementById('close-admin-btn');
const carForm = document.getElementById('car-form');
const formTitle = document.getElementById('form-title');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

// Elementos de Filtro
const searchInput = document.getElementById('search-input');
const brandFilter = document.getElementById('brand-filter');
const bodyFilter = document.getElementById('body-filter');

// Inicialização da Aplicação
document.addEventListener('DOMContentLoaded', async () => {
    try {
        cars = await getAllCarsFromDB();
        
        if (cars.length === 0) {
            const initialCar = {
                id: "1",
                title: "HONDA CR-V EXL 2.0 FLEX",
                brand: "Honda",
                type: "SUV",
                year: "2012 / 2012",
                km: "141.000 km",
                price: "65.900",
                images: ["https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80"]
            };
            await saveCarToDB(initialCar);
            cars = [initialCar];
        }
        renderCars();
    } catch (err) {
        console.error("Erro ao carregar veículos:", err);
    }

    setupEventListeners();
});

function setupEventListeners() {
    // Gestão de Sessão do Admin
    adminToggleBtn.addEventListener('click', () => {
        if (!isAdminLoggedIn) {
            const passwordInput = prompt("Digite a palavra-passe de administrador:");
            if (passwordInput === ADMIN_PASSWORD) {
                isAdminLoggedIn = true;
                adminToggleBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Sair do Admin';
                adminSection.classList.remove('hidden');
                renderCars(); // Re-renderiza para mostrar botões de edição
            } else if (passwordInput !== null) {
                alert("Palavra-passe incorreta!");
            }
        } else {
            // Fazer Logoff
            isAdminLoggedIn = false;
            adminToggleBtn.innerHTML = '<i class="fas fa-lock"></i> Entrar como Admin';
            adminSection.classList.add('hidden');
            resetForm();
            renderCars(); // Re-renderiza para esconder botões de edição
        }
    });

    closeAdminBtn.addEventListener('click', () => {
        adminSection.classList.add('hidden');
        resetForm();
    });

    cancelEditBtn.addEventListener('click', resetForm);
    carForm.addEventListener('submit', handleFormSubmit);

    searchInput.addEventListener('input', renderCars);
    brandFilter.addEventListener('change', renderCars);
    bodyFilter.addEventListener('change', renderCars);
}

// Redimensionamento de Imagens
function compressImage(file, maxWidth = 1024, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

async function processSelectedImages(files) {
    const promises = Array.from(files).map(file => compressImage(file));
    return await Promise.all(promises);
}

async function handleFormSubmit(e) {
    e.preventDefault();

    if (!isAdminLoggedIn) return;

    const submitBtn = carForm.querySelector('.btn-submit');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A guardar...';
    submitBtn.disabled = true;

    try {
        const carId = document.getElementById('car-id').value;
        const title = document.getElementById('car-title-input').value;
        const brand = document.getElementById('car-brand-input').value;
        const type = document.getElementById('car-type-input').value;
        const year = document.getElementById('car-year-input').value;
        const km = document.getElementById('car-km-input').value;
        const price = document.getElementById('car-price-input').value;
        const imageInput = document.getElementById('car-image-input');

        let images = [];
        if (imageInput.files.length > 0) {
            images = await processSelectedImages(imageInput.files);
        }

        if (carId) {
            const index = cars.findIndex(c => c.id === carId);
            if (index !== -1) {
                const updatedCar = {
                    ...cars[index],
                    title,
                    brand,
                    type,
                    year,
                    km,
                    price,
                    images: images.length > 0 ? images : cars[index].images
                };
                await saveCarToDB(updatedCar);
                cars[index] = updatedCar;
            }
        } else {
            const newCar = {
                id: Date.now().toString(),
                title,
                brand,
                type,
                year,
                km,
                price,
                images: images.length > 0 ? images : ["https://via.placeholder.com/600x400?text=Sem+Foto"]
            };
            await saveCarToDB(newCar);
            cars.unshift(newCar);
        }

        renderCars();
        resetForm();
        alert('Veículo guardado com sucesso!');
    } catch (error) {
        console.error("Erro ao guardar no IndexedDB:", error);
        alert('Ocorreu um erro ao guardar. Tente novamente.');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function renderCars() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedBrand = brandFilter.value;
    const selectedBody = bodyFilter.value;

    const filteredCars = cars.filter(car => {
        const matchesSearch = car.title.toLowerCase().includes(searchTerm) || car.brand.toLowerCase().includes(searchTerm);
        const matchesBrand = selectedBrand === 'all' || car.brand === selectedBrand;
        const matchesBody = selectedBody === 'all' || car.type === selectedBody;
        return matchesSearch && matchesBrand && matchesBody;
    });

    carGrid.innerHTML = '';

    if (filteredCars.length === 0) {
        carGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #a1a1aa; padding: 40px;">Nenhum veículo encontrado.</p>`;
        return;
    }

    filteredCars.forEach(car => {
        const carCard = createCarCard(car);
        carGrid.appendChild(carCard);
    });
}

function createCarCard(car) {
    const card = document.createElement('div');
    card.className = 'car-card';

    const imagesList = Array.isArray(car.images) && car.images.length > 0 ? car.images : [car.image || "https://via.placeholder.com/600x400?text=Sem+Foto"];

    let carouselHTML = '';
    if (imagesList.length > 1) {
        carouselHTML = `
            <div class="car-carousel">
                ${imagesList.map((img, idx) => `
                    <div class="carousel-slide ${idx === 0 ? 'active' : ''}">
                        <img src="${img}" alt="${car.title}">
                    </div>
                `).join('')}
                <button type="button" class="carousel-btn prev" onclick="moveSlide(event, -1)"><i class="fas fa-chevron-left"></i></button>
                <button type="button" class="carousel-btn next" onclick="moveSlide(event, 1)"><i class="fas fa-chevron-right"></i></button>
                <div class="carousel-dots">
                    ${imagesList.map((_, idx) => `<span class="dot ${idx === 0 ? 'active' : ''}"></span>`).join('')}
                </div>
            </div>
        `;
    } else {
        carouselHTML = `
            <div class="car-carousel">
                <div class="carousel-slide active">
                    <img src="${imagesList[0]}" alt="${car.title}">
                </div>
            </div>
        `;
    }

    const whatsappMessage = encodeURIComponent(`Olá! Tenho interesse no veículo ${car.title} (R$ ${car.price}). Poderia me dar mais informações?`);

    // Exibe botões de Editar/Eliminar SOMENTE se o Admin estiver autenticado
    const adminButtonsHTML = isAdminLoggedIn ? `
        <div class="admin-card-actions">
            <button type="button" class="btn-edit" onclick="editCar('${car.id}')"><i class="fas fa-edit"></i> Editar</button>
            <button type="button" class="btn-delete" onclick="deleteCar('${car.id}')"><i class="fas fa-trash"></i> Excluir</button>
        </div>
    ` : '';

    card.innerHTML = `
        <span class="card-tag">${car.type}</span>
        ${carouselHTML}
        <div class="car-info">
            <h3 class="car-title">${car.title}</h3>
            <div class="car-price">R$ ${car.price}</div>
            <div class="car-details">
                <span><i class="far fa-calendar-alt"></i> ${car.year}</span>
                <span><i class="fas fa-tachometer-alt"></i> ${car.km}</span>
            </div>
            <div class="car-actions">
                <a href="https://wa.me/5500000000000?text=${whatsappMessage}" target="_blank" class="btn-whatsapp">
                    <i class="fab fa-whatsapp"></i> Tenho Interesse
                </a>
                ${adminButtonsHTML}
            </div>
        </div>
    `;

    return card;
}

window.moveSlide = function(event, direction) {
    const card = event.target.closest('.car-card');
    const slides = card.querySelectorAll('.carousel-slide');
    const dots = card.querySelectorAll('.dot');
    let activeIndex = Array.from(slides).findIndex(s => s.classList.contains('active'));

    slides[activeIndex].classList.remove('active');
    if (dots.length) dots[activeIndex].classList.remove('active');

    activeIndex += direction;
    if (activeIndex < 0) activeIndex = slides.length - 1;
    if (activeIndex >= slides.length) activeIndex = 0;

    slides[activeIndex].classList.add('active');
    if (dots.length) dots[activeIndex].classList.add('active');
};

window.editCar = function(id) {
    if (!isAdminLoggedIn) return;
    const car = cars.find(c => c.id === id);
    if (!car) return;

    document.getElementById('car-id').value = car.id;
    document.getElementById('car-title-input').value = car.title;
    document.getElementById('car-brand-input').value = car.brand;
    document.getElementById('car-type-input').value = car.type;
    document.getElementById('car-year-input').value = car.year;
    document.getElementById('car-km-input').value = car.km;
    document.getElementById('car-price-input').value = car.price;

    formTitle.textContent = "Editar Veículo";
    cancelEditBtn.classList.remove('hidden');
    adminSection.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteCar = async function(id) {
    if (!isAdminLoggedIn) return;
    if (confirm('Tem certeza que deseja excluir este veículo?')) {
        await deleteCarFromDB(id);
        cars = cars.filter(c => c.id !== id);
        renderCars();
    }
};

function resetForm() {
    carForm.reset();
    document.getElementById('car-id').value = '';
    formTitle.textContent = "Cadastrar Novo Veículo";
    cancelEditBtn.classList.add('hidden');
}
