-- TitaniumX: catálogo público e carrinho privado por cliente.
-- Execute este arquivo no SQL Editor do projeto Supabase antes de usar o site.

create table if not exists public.products (
    id text primary key,
    name text not null,
    category text not null,
    price numeric(10,2) not null check (price >= 0),
    image_path text not null,
    sort_order integer not null default 0,
    active boolean not null default true,
    stock integer check (stock is null or stock >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

insert into public.products (id, name, category, price, image_path, sort_order, active)
values
    ('camiseta-esportiva', 'Camiseta Esportiva', 'ROUPAS', 67.00, 'images.jpg', 1, true),
    ('chuteira-esportiva', 'Chuteira Esportiva', 'CALÇADOS', 67.90, 'Nike-Chuteira.webp', 2, true),
    ('bola-esportiva', 'Bola Esportiva', 'ACESSÓRIOS', 67.90, 'bola verde.jpeg', 3, true),
    ('acessorios-academia', 'Acessórios de Academia', 'TREINO', 67.90, 'peso academia 2.avif', 4, true)
on conflict (id) do update set
    name = excluded.name,
    category = excluded.category,
    price = excluded.price,
    image_path = excluded.image_path,
    sort_order = excluded.sort_order,
    active = excluded.active,
    updated_at = now();

create table if not exists public.cart_items (
    user_id uuid not null references auth.users(id) on delete cascade,
    product_id text not null references public.products(id) on delete cascade,
    quantity integer not null check (quantity > 0),
    updated_at timestamptz not null default now(),
    primary key (user_id, product_id)
);

alter table public.products enable row level security;
alter table public.cart_items enable row level security;

revoke all on table public.products from anon, authenticated;
revoke all on table public.cart_items from anon, authenticated;
grant select on table public.products to anon, authenticated;
grant select, insert, update, delete on table public.cart_items to authenticated;

drop policy if exists "Anyone can read active products" on public.products;
create policy "Anyone can read active products"
    on public.products for select
    to anon, authenticated
    using (active = true);

drop policy if exists "Customers read their own cart" on public.cart_items;
create policy "Customers read their own cart"
    on public.cart_items for select
    to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "Customers add to their own cart" on public.cart_items;
create policy "Customers add to their own cart"
    on public.cart_items for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "Customers update their own cart" on public.cart_items;
create policy "Customers update their own cart"
    on public.cart_items for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop policy if exists "Customers delete from their own cart" on public.cart_items;
create policy "Customers delete from their own cart"
    on public.cart_items for delete
    to authenticated
    using ((select auth.uid()) = user_id);

create table if not exists public.orders (
    id uuid primary key default pg_catalog.gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    customer_email text not null,
    total numeric(10,2) not null check (total >= 0),
    status text not null default 'pending_whatsapp' check (status in ('pending_whatsapp','confirmed','cancelled')),
    created_at timestamptz not null default now()
);

create table if not exists public.order_items (
    id bigint generated always as identity primary key,
    order_id uuid not null references public.orders(id) on delete cascade,
    product_id text not null,
    product_name text not null,
    unit_price numeric(10,2) not null check (unit_price >= 0),
    quantity integer not null check (quantity > 0)
);
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
revoke all on table public.orders, public.order_items from anon, authenticated;
grant select on table public.orders, public.order_items to authenticated;

drop policy if exists "Customers read their own orders" on public.orders;
create policy "Customers read their own orders"
    on public.orders for select to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "Customers read their own order items" on public.order_items;
create policy "Customers read their own order items"
    on public.order_items for select to authenticated
    using (exists (
        select 1 from public.orders
        where public.orders.id = order_items.order_id
          and public.orders.user_id = (select auth.uid())
    ));

create or replace function public.place_order(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_order_id uuid := pg_catalog.gen_random_uuid();
    v_item record;
    v_name text;
    v_price numeric(10,2);
    v_stock integer;
    v_total numeric(10,2) := 0;
begin
    if v_user_id is null then
        raise exception 'É necessário entrar na conta para registrar um pedido.';
    end if;
    if pg_catalog.jsonb_typeof(p_items) <> 'array' or pg_catalog.jsonb_array_length(p_items) = 0 then
        raise exception 'O pedido precisa ter pelo menos um produto.';
    end if;

    for v_item in
        select product_id, sum(quantity)::integer as quantity
        from pg_catalog.jsonb_to_recordset(p_items) as line(product_id text, quantity integer)
        group by product_id
    loop
        if v_item.product_id is null or v_item.quantity is null or v_item.quantity < 1 then
            raise exception 'Produto ou quantidade inválida.';
        end if;
        select name, price, stock into v_name, v_price, v_stock
        from public.products
        where id = v_item.product_id and active = true
        for update;
        if not found then
            raise exception 'Um produto do pedido não está mais disponível.';
        end if;
        if v_stock is not null and v_item.quantity > v_stock then
            raise exception 'Estoque insuficiente para %.', v_name;
        end if;
        if v_stock is not null then
            update public.products set stock = stock - v_item.quantity, updated_at = now()
            where id = v_item.product_id;
        end if;
        v_total := v_total + (v_price * v_item.quantity);
    end loop;

    insert into public.orders (id, user_id, customer_email, total, status)
    values (v_order_id, v_user_id, coalesce(auth.jwt() ->> 'email', ''), v_total, 'pending_whatsapp');

    for v_item in
        select product_id, sum(quantity)::integer as quantity
        from pg_catalog.jsonb_to_recordset(p_items) as line(product_id text, quantity integer)
        group by product_id
    loop
        select name, price into v_name, v_price from public.products where id = v_item.product_id;
        insert into public.order_items (order_id, product_id, product_name, unit_price, quantity)
        values (v_order_id, v_item.product_id, v_name, v_price, v_item.quantity);
    end loop;

    delete from public.cart_items
    where user_id = v_user_id
      and product_id in (select product_id from pg_catalog.jsonb_to_recordset(p_items) as line(product_id text, quantity integer));

    return jsonb_build_object('order_id', v_order_id, 'total', v_total);
end;
$$;

revoke all on function public.place_order(jsonb) from public, anon;
grant execute on function public.place_order(jsonb) to authenticated;


create table if not exists public.store_content (
    id text primary key,
    content jsonb not null,
    updated_at timestamptz not null default now()
);

insert into public.store_content (id, content) values
('about', $json${
  "title": "Sobre Nós – TitaniumX",
  "tagline": "Paixão pelo esporte, estilo e qualidade!",
  "paragraphs": [
    "A TitaniumX é uma loja especializada em artigos esportivos, criada para quem vive a paixão pelo esporte dentro e fora de campo.",
    "Aqui você encontra uma variedade de produtos para acompanhar seu estilo e sua paixão pelo universo esportivo, incluindo camisas de times de futebol, roupas esportivas, bolas, acessórios e diversos outros artigos para quem ama esporte.",
    "Nosso objetivo é oferecer produtos que unam estilo, qualidade e praticidade, atendendo desde os torcedores apaixonados por seus times até atletas e pessoas que gostam de manter uma vida ativa.",
    "Acreditamos que o esporte vai muito além de uma atividade: é paixão, união, dedicação e superação. Por isso, queremos fazer parte da sua jornada, oferecendo produtos que representem tudo aquilo que você ama no mundo esportivo."
  ],
  "mission": "Oferecer produtos esportivos que atendam às necessidades dos nossos clientes, valorizando qualidade, estilo e satisfação.",
  "vision": "Ser uma loja reconhecida pela variedade de artigos esportivos e pela confiança dos nossos clientes.",
  "values": ["Qualidade nos produtos.", "Compromisso com os clientes.", "Paixão pelo esporte.", "Confiança e respeito.", "Dedicação e superação."],
  "brand": "TITANIUMX",
  "slogan": "Vista sua paixão. Viva o esporte. Seja TitaniumX!"
}$json$::jsonb),
('contact', $json${
  "phone_e164": "+5589994465569",
  "phone_display": "(89) 99446-5569"
}$json$::jsonb)
on conflict (id) do nothing;

alter table public.store_content enable row level security;
revoke all on table public.store_content from anon, authenticated;
grant select on table public.store_content to anon, authenticated;
drop policy if exists "Anyone can read store content" on public.store_content;
create policy "Anyone can read store content"
    on public.store_content for select
    to anon, authenticated
    using (true);


