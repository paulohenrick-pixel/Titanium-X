(() => {
    const config = window.SUPABASE_CONFIG;
    if (!config || !window.supabase?.createClient) {
        console.error("Não foi possível carregar o cliente Supabase.");
        return;
    }

    const supabase = window.supabase.createClient(config.url, config.publishableKey);
    const cartKey = "titaniumX-carrinho";
    const cartDialog = document.getElementById("carrinho");
    const cartList = document.querySelector(".carrinho-itens");
    const cartCount = document.getElementById("quantidade");
    const cartTotal = document.querySelector(".carrinho-total strong");
    const authForm = document.getElementById("auth-form");
    const authEmail = document.getElementById("auth-email");
    const authPassword = document.getElementById("auth-password");
    const authStatus = document.getElementById("auth-status");
    const authFeedback = document.getElementById("auth-feedback");
    const registerButton = document.getElementById("auth-cadastrar");
    const signOutButton = document.getElementById("auth-sair");
    const money = value => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    let currentUser = null;
    let processedUserId;
    let whatsappNumber = "5589994465569";
    let products = [...document.querySelectorAll(".comprar")].map(button => ({
        id: button.dataset.productId,
        name: button.dataset.produto,
        category: button.closest(".produto").querySelector(".categoria").textContent,
        price: Number(button.dataset.preco),
        image_path: button.closest(".produto").querySelector("img").getAttribute("src")
    }));
    let cart = readGuestCart();

    function readGuestCart() {
        try {
            const saved = JSON.parse(localStorage.getItem(cartKey) || "[]");
            if (!Array.isArray(saved)) return [];
            return saved.map(savedItem => {
                const product = products.find(item => item.id === savedItem.product_id || item.name === savedItem.nome);
                const quantity = Number(savedItem.quantidade ?? savedItem.quantity);
                return product && Number.isInteger(quantity) && quantity > 0
                    ? { product_id: product.id, name: product.name, price: product.price, quantity }
                    : null;
            }).filter(Boolean);
        } catch {
            return [];
        }
    }

    function setFeedback(message, isError = false) {
        authFeedback.textContent = message;
        authFeedback.dataset.error = String(isError);
    }

    function updateAuthView() {
        if (currentUser) {
            authStatus.textContent = `Conectado como ${currentUser.email}. Seu carrinho sincroniza nesta conta.`;
            authForm.hidden = true;
            signOutButton.hidden = false;
        } else {
            authStatus.textContent = "Entre na sua conta para sincronizar o carrinho entre dispositivos.";
            authForm.hidden = false;
            signOutButton.hidden = true;
        }
    }

    function updateCartView() {
        cartList.replaceChildren();
        const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        cartCount.textContent = itemCount;
        cartTotal.textContent = money(total);

        if (!cart.length) {
            const empty = document.createElement("p");
            empty.className = "carrinho-vazio";
            empty.textContent = "Seu carrinho está vazio.";
            cartList.append(empty);
            return;
        }

        cart.forEach(item => {
            const row = document.createElement("article");
            row.className = "carrinho-item";
            const details = document.createElement("div");
            details.className = "carrinho-item-detalhes";
            const name = document.createElement("h3");
            name.textContent = item.name;
            const price = document.createElement("p");
            price.textContent = `${money(item.price)} cada`;
            details.append(name, price);

            const controls = document.createElement("div");
            controls.className = "carrinho-controles";
            const decrease = document.createElement("button");
            decrease.type = "button";
            decrease.textContent = "−";
            decrease.setAttribute("aria-label", `Diminuir quantidade de ${item.name}`);
            decrease.dataset.action = "decrease";
            decrease.dataset.productId = item.product_id;
            const quantity = document.createElement("span");
            quantity.textContent = item.quantity;
            const increase = document.createElement("button");
            increase.type = "button";
            increase.textContent = "+";
            increase.setAttribute("aria-label", `Aumentar quantidade de ${item.name}`);
            increase.dataset.action = "increase";
            increase.dataset.productId = item.product_id;
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "carrinho-remover";
            remove.textContent = "Excluir";
            remove.setAttribute("aria-label", `Remover ${item.name} do carrinho`);
            remove.dataset.action = "remove";
            remove.dataset.productId = item.product_id;
            controls.append(decrease, quantity, increase, remove);
            row.append(details, controls);
            cartList.append(row);
        });
    }

    function renderProducts() {
        const grid = document.querySelector(".grade-produtos");
        grid.replaceChildren();
        if (!products.length) {
            const empty = document.createElement("p");
            empty.className = "catalogo-vazio";
            empty.textContent = "Nenhum produto disponível no momento.";
            grid.append(empty);
            return;
        }
        products.forEach(product => {
            const card = document.createElement("article");
            card.className = "produto";
            const image = document.createElement("img");
            image.src = product.image_path;
            image.alt = product.name;
            const info = document.createElement("div");
            info.className = "produto-info";
            const category = document.createElement("span");
            category.className = "categoria";
            category.textContent = product.category;
            const name = document.createElement("h3");
            name.textContent = product.name;
            const price = document.createElement("p");
            price.className = "preco";
            price.textContent = money(product.price);
            const button = document.createElement("button");
            button.type = "button";
            button.className = "botao comprar";
            button.dataset.productId = product.id;
            button.dataset.produto = product.name;
            button.dataset.preco = product.price;
            button.textContent = "Adicionar ao carrinho";
            button.disabled = product.stock !== null && product.stock !== undefined && Number(product.stock) <= 0;
            if (button.disabled) button.textContent = "Indisponível";
            info.append(category, name, price, button);
            card.append(image, info);
            grid.append(card);
        });
    }
    function renderStoreContent(entries) {
        const about = entries.about;
        if (about) {
            const section = document.getElementById("sobre");
            section.replaceChildren();
            const add = (tag, text, parent = section) => {
                const element = document.createElement(tag);
                element.textContent = text;
                parent.append(element);
                return element;
            };
            add("h2", about.title);
            add("h3", about.tagline);
            (about.paragraphs || []).forEach(text => add("p", text));
            add("h3", "Nossa missão");
            add("p", about.mission);
            add("h3", "Nossa visão");
            add("p", about.vision);
            add("h3", "Nossos valores");
            const values = document.createElement("ul");
            (about.values || []).forEach(text => add("li", text, values));
            section.append(values);
            const brand = add("p", about.brand);
            const brandStrong = document.createElement("strong");
            brandStrong.textContent = brand.textContent;
            brand.replaceChildren(brandStrong);
            const slogan = add("p", about.slogan);
            const sloganStrong = document.createElement("strong");
            sloganStrong.textContent = slogan.textContent;
            slogan.replaceChildren(sloganStrong);
        }

        const contact = entries.contact;
        if (contact) {
            const section = document.getElementById("contato");
            section.replaceChildren();
            const heading = document.createElement("h2");
            heading.textContent = "Contato";
            const paragraph = document.createElement("p");
            const digits = String(contact.phone_e164 || "").replace(/\D/g, "");
            if (digits) whatsappNumber = digits;
            if (digits && contact.phone_display) {
                paragraph.append("Telefone: ");
                const telephone = document.createElement("a");
                telephone.href = `tel:+${digits}`;
                telephone.textContent = contact.phone_display;
                paragraph.append(telephone, " · WhatsApp: ");
                const whatsapp = document.createElement("a");
                whatsapp.href = `https://wa.me/${digits}`;
                whatsapp.target = "_blank";
                whatsapp.rel = "noopener noreferrer";
                whatsapp.textContent = contact.phone_display;
                paragraph.append(whatsapp);
            } else {
                paragraph.textContent = "As informações de contato ainda não estão cadastradas nesta página.";
            }
            section.append(heading, paragraph);
        }
    }

    async function loadStoreContent() {
        const { data, error } = await supabase.from("store_content").select("id,content");
        if (error) {
            console.warn("Conteúdo institucional segue a cópia local até a tabela store_content ser configurada.", error.message);
            return;
        }
        const entries = Object.fromEntries((data || []).map(item => [item.id, item.content]));
        renderStoreContent(entries);
    }
    async function loadProducts() {
        const { data, error } = await supabase.from("products")
            .select("id,name,category,price,image_path,stock")
            .eq("active", true)
            .order("sort_order");
        if (error) {
            console.error("Falha ao carregar produtos do Supabase:", error.message);
            setFeedback("Catálogo ainda não conectado. Execute o arquivo supabase-setup.sql no SQL Editor do projeto.", true);
            return;
        }
        products = (data || []).map(item => ({ ...item, price: Number(item.price) }));
        renderProducts();
        if (currentUser) {
            cart = cart.map(item => {
                const product = products.find(entry => entry.id === item.product_id);
                return product ? { ...item, name: product.name, price: product.price } : null;
            }).filter(Boolean);
        } else {
            cart = readGuestCart();
        }
        updateCartView();
    }

    function saveGuestCart() {
        try {
            localStorage.setItem(cartKey, JSON.stringify(cart.map(({ product_id, quantity }) => ({ product_id, quantity }))));
        } catch (error) {
            console.warn("Não foi possível salvar o carrinho localmente.", error);
        }
    }

    async function loadAccountCart(user) {
        const { data, error } = await supabase.from("cart_items")
            .select("product_id,quantity")
            .eq("user_id", user.id);
        if (error) throw error;

        const merged = new Map((data || []).map(row => [row.product_id, Number(row.quantity)]));
        readGuestCart().forEach(item => merged.set(item.product_id, (merged.get(item.product_id) || 0) + item.quantity));
        const rows = [...merged].map(([product_id, quantity]) => ({ user_id: user.id, product_id, quantity }));
        if (rows.length) {
            const { error: saveError } = await supabase.from("cart_items").upsert(rows, { onConflict: "user_id,product_id" });
            if (saveError) throw saveError;
        }
        localStorage.removeItem(cartKey);
        cart = [...merged].map(([product_id, quantity]) => {
            const product = products.find(item => item.id === product_id);
            return product ? { product_id, name: product.name, price: product.price, quantity } : null;
        }).filter(Boolean);
        updateCartView();
    }

    async function applySession(session) {
        const user = session?.user || null;
        if (user?.id === processedUserId) return;
        processedUserId = user?.id || null;
        currentUser = user;
        updateAuthView();
        if (user) {
            try {
                await loadAccountCart(user);
                setFeedback("");
            } catch (error) {
                console.error("Falha ao sincronizar o carrinho:", error.message);
                setFeedback("Não foi possível sincronizar o carrinho. Confira se aplicou supabase-setup.sql.", true);
            }
        } else {
            cart = readGuestCart();
            updateCartView();
        }
    }

    async function persistAccountItem(item) {
        let result;
        if (item.quantity <= 0) {
            result = await supabase.from("cart_items").delete()
                .eq("user_id", currentUser.id).eq("product_id", item.product_id);
        } else {
            result = await supabase.from("cart_items").upsert({
                user_id: currentUser.id,
                product_id: item.product_id,
                quantity: item.quantity
            }, { onConflict: "user_id,product_id" });
        }
        if (result.error) throw result.error;
    }

    async function changeItem(productId, action) {
        const product = products.find(item => item.id === productId);
        if (!product) return;
        const index = cart.findIndex(item => item.product_id === productId);
        const previous = index >= 0 ? { ...cart[index] } : null;
        if (action === "increase" && product.stock !== null && product.stock !== undefined) {
            const requested = (index >= 0 ? cart[index].quantity : 0) + 1;
            if (requested > Number(product.stock)) {
                setFeedback("Quantidade máxima disponível atingida.", true);
                return;
            }
        }
        if (action === "remove") {
            cart = cart.filter(item => item.product_id !== productId);
        } else if (index >= 0) {
            cart[index].quantity += action === "increase" ? 1 : -1;
            if (cart[index].quantity <= 0) cart.splice(index, 1);
        } else if (action === "increase") {
            cart.push({ product_id: product.id, name: product.name, price: product.price, quantity: 1 });
        }
        updateCartView();
        try {
            const item = cart.find(value => value.product_id === productId);
            if (currentUser) await persistAccountItem(item || { product_id: productId, quantity: 0 });
            else saveGuestCart();
            setFeedback("");
        } catch (error) {
            console.error("Falha ao salvar o carrinho:", error.message);
            if (previous) {
                const restoredIndex = cart.findIndex(value => value.product_id === productId);
                if (restoredIndex >= 0) cart[restoredIndex] = previous;
                else cart.push(previous);
            } else {
                cart = cart.filter(value => value.product_id !== productId);
            }
            updateCartView();
            setFeedback("Não foi possível salvar a alteração do carrinho.", true);
        }
    }

    document.querySelector(".grade-produtos").addEventListener("click", event => {
        const button = event.target.closest(".comprar[data-product-id]");
        if (button) changeItem(button.dataset.productId, "increase");
    });
    cartList.addEventListener("click", event => {
        const button = event.target.closest("button[data-action]");
        if (button) changeItem(button.dataset.productId, button.dataset.action);
    });
    document.querySelector(".carrinho").addEventListener("click", event => {
        event.preventDefault();
        cartDialog.showModal();
    });
    document.querySelector(".carrinho-fechar").addEventListener("click", () => cartDialog.close());
    cartDialog.addEventListener("click", event => {
        if (event.target === cartDialog) cartDialog.close();
    });

    document.getElementById("pedido-whatsapp").addEventListener("click", async event => {
        if (!currentUser || !cart.length) return;
        const button = event.currentTarget;
        button.disabled = true;
        setFeedback("Registrando pedido...");
        const whatsappTab = window.open("about:blank", "_blank");
        try {
            const { data, error } = await supabase.rpc("place_order", {
                p_items: cart.map(item => ({ product_id: item.product_id, quantity: item.quantity }))
            });
            if (error) throw error;
            const orderId = data.order_id;
            const message = encodeURIComponent(`Olá! Quero confirmar o pedido ${orderId}.\n${cart.map(item => `${item.quantity}x ${item.name}`).join("\n")}\nTotal: ${money(data.total)}`);
            const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;
            cart = [];
            updateCartView();
            setFeedback(`Pedido ${orderId} registrado. Abrindo o WhatsApp...`);
            if (whatsappTab) whatsappTab.location.href = whatsappUrl;
            else window.location.href = whatsappUrl;
        } catch (error) {
            if (whatsappTab) whatsappTab.close();
            console.error("Falha ao registrar o pedido:", error.message);
            setFeedback("Não foi possível registrar o pedido. Confira a configuração do banco e tente novamente.", true);
            button.disabled = !currentUser || cart.length === 0;
        }
    });
    authForm.addEventListener("submit", async event => {
        event.preventDefault();
        setFeedback("Entrando...");
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail.value.trim(), password: authPassword.value });
        if (error) setFeedback(error.message, true);
        else { setFeedback("Login realizado."); authPassword.value = ""; }
    });
    registerButton.addEventListener("click", async () => {
        if (!authForm.reportValidity()) return;
        setFeedback("Criando conta...");
        const { data, error } = await supabase.auth.signUp({ email: authEmail.value.trim(), password: authPassword.value, options: { emailRedirectTo: window.location.origin + window.location.pathname } });
        if (error) setFeedback(error.message, true);
        else if (!data.session) setFeedback("Conta criada. Confira seu e-mail para confirmar o cadastro antes de entrar.");
        else { setFeedback("Conta criada com sucesso."); authPassword.value = ""; }
    });
    signOutButton.addEventListener("click", async () => {
        const { error } = await supabase.auth.signOut();
        if (error) setFeedback(error.message, true);
        else setFeedback("Você saiu da sua conta.");
    });

    supabase.auth.onAuthStateChange((_event, session) => {
        queueMicrotask(() => applySession(session));
    });

    updateAuthView();
    updateCartView();
    loadProducts();
    loadStoreContent();
    supabase.auth.getSession().then(({ data, error }) => {
        if (error) setFeedback(error.message, true);
        else applySession(data.session);
    });
})();













