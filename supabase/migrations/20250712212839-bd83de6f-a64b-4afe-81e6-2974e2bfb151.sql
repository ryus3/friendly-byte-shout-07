-- Create complete database schema for Al-Waseet system

-- Categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Colors table
CREATE TABLE public.colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  hex_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sizes table
CREATE TABLE public.sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.categories(id),
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  barcode TEXT UNIQUE,
  images TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES public.profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Product variants table
CREATE TABLE public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  color_id UUID REFERENCES public.colors(id),
  size_id UUID REFERENCES public.sizes(id),
  price DECIMAL(10,2) NOT NULL,
  cost_price DECIMAL(10,2) NOT NULL,
  barcode TEXT UNIQUE,
  images TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, color_id, size_id)
);

-- Inventory table
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  location TEXT,
  last_updated_by UUID NOT NULL REFERENCES public.profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, variant_id)
);

-- Customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  province TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  customer_city TEXT,
  customer_province TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  final_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  delivery_partner TEXT,
  tracking_number TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(user_id),
  assigned_to UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Order items table
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Purchases table
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_number TEXT NOT NULL UNIQUE,
  supplier_name TEXT NOT NULL,
  supplier_contact TEXT,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Purchase items table
CREATE TABLE public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  quantity INTEGER NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Profits table
CREATE TABLE public.profits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id),
  employee_id UUID NOT NULL REFERENCES public.profiles(user_id),
  total_revenue DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  profit_amount DECIMAL(10,2) NOT NULL,
  employee_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  employee_profit DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  settled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Categories policies
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage categories" ON public.categories FOR ALL USING (auth.uid() IS NOT NULL);

-- Colors policies
CREATE POLICY "Anyone can view colors" ON public.colors FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage colors" ON public.colors FOR ALL USING (auth.uid() IS NOT NULL);

-- Sizes policies
CREATE POLICY "Anyone can view sizes" ON public.sizes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage sizes" ON public.sizes FOR ALL USING (auth.uid() IS NOT NULL);

-- Products policies
CREATE POLICY "Anyone can view active products" ON public.products FOR SELECT USING (is_active = true OR auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage products" ON public.products FOR ALL USING (auth.uid() IS NOT NULL);

-- Product variants policies
CREATE POLICY "Anyone can view active variants" ON public.product_variants FOR SELECT USING (is_active = true OR auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage variants" ON public.product_variants FOR ALL USING (auth.uid() IS NOT NULL);

-- Inventory policies
CREATE POLICY "Authenticated users can view inventory" ON public.inventory FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage inventory" ON public.inventory FOR ALL USING (auth.uid() IS NOT NULL);

-- Customers policies
CREATE POLICY "Authenticated users can view customers" ON public.customers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage customers" ON public.customers FOR ALL USING (auth.uid() IS NOT NULL);

-- Orders policies
CREATE POLICY "Authenticated users can view orders" ON public.orders FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage orders" ON public.orders FOR ALL USING (auth.uid() IS NOT NULL);

-- Order items policies
CREATE POLICY "Authenticated users can view order items" ON public.order_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage order items" ON public.order_items FOR ALL USING (auth.uid() IS NOT NULL);

-- Purchases policies
CREATE POLICY "Authenticated users can view purchases" ON public.purchases FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage purchases" ON public.purchases FOR ALL USING (auth.uid() IS NOT NULL);

-- Purchase items policies
CREATE POLICY "Authenticated users can view purchase items" ON public.purchase_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage purchase items" ON public.purchase_items FOR ALL USING (auth.uid() IS NOT NULL);

-- Profits policies
CREATE POLICY "Users can view their own profits" ON public.profits FOR SELECT USING (employee_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can manage all profits" ON public.profits FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- Notifications policies
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Authenticated users can create notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());

-- Create triggers for timestamp updates
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_colors_updated_at BEFORE UPDATE ON public.colors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sizes_updated_at BEFORE UPDATE ON public.sizes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profits_updated_at BEFORE UPDATE ON public.profits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('product-images', 'product-images', true),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for product images
CREATE POLICY "Product images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Authenticated users can upload product images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update product images" ON storage.objects FOR UPDATE USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete product images" ON storage.objects FOR DELETE USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

-- Storage policies for avatars
CREATE POLICY "Avatars are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own avatar" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Smart username login function
CREATE OR REPLACE FUNCTION public.auth_with_username(username_input TEXT, password_input TEXT)
RETURNS TABLE(success BOOLEAN, user_email TEXT, error_message TEXT) AS $$
DECLARE
  user_email_found TEXT;
BEGIN
  -- Get email associated with username
  SELECT email INTO user_email_found 
  FROM public.profiles 
  WHERE LOWER(username) = LOWER(username_input) 
  AND is_active = true 
  AND status = 'active';
  
  IF user_email_found IS NULL THEN
    RETURN QUERY SELECT false, ''::TEXT, 'اسم المستخدم غير صحيح'::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT true, user_email_found, ''::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate automatic order numbers
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  order_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.orders
  WHERE order_number ~ '^ORD[0-9]+$';
  
  order_number := 'ORD' || LPAD(next_number::TEXT, 6, '0');
  RETURN order_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate automatic purchase numbers
CREATE OR REPLACE FUNCTION public.generate_purchase_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  purchase_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(purchase_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.purchases
  WHERE purchase_number ~ '^PUR[0-9]+$';
  
  purchase_number := 'PUR' || LPAD(next_number::TEXT, 6, '0');
  RETURN purchase_number;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate profits
CREATE OR REPLACE FUNCTION public.calculate_order_profit(order_id_input UUID)
RETURNS VOID AS $$
DECLARE
  order_record RECORD;
  total_cost DECIMAL(10,2) := 0;
  total_revenue DECIMAL(10,2) := 0;
  profit_amount DECIMAL(10,2) := 0;
  employee_percentage DECIMAL(5,2) := 0;
  employee_profit DECIMAL(10,2) := 0;
BEGIN
  -- Get order details
  SELECT o.*, p.role 
  INTO order_record
  FROM public.orders o
  LEFT JOIN public.profiles p ON o.created_by = p.user_id
  WHERE o.id = order_id_input;
  
  IF order_record IS NULL THEN
    RETURN;
  END IF;
  
  -- Calculate total cost and revenue
  SELECT 
    COALESCE(SUM(oi.quantity * COALESCE(pv.cost_price, pr.cost_price)), 0),
    COALESCE(SUM(oi.total_price), 0)
  INTO total_cost, total_revenue
  FROM public.order_items oi
  LEFT JOIN public.products pr ON oi.product_id = pr.id
  LEFT JOIN public.product_variants pv ON oi.variant_id = pv.id
  WHERE oi.order_id = order_id_input;
  
  profit_amount := total_revenue - total_cost;
  
  -- Set employee percentage based on role
  employee_percentage := CASE 
    WHEN order_record.role = 'admin' THEN 100.0
    WHEN order_record.role = 'manager' THEN 15.0
    ELSE 10.0
  END;
  
  employee_profit := profit_amount * (employee_percentage / 100.0);
  
  -- Insert or update profit record
  INSERT INTO public.profits (
    order_id,
    employee_id,
    total_revenue,
    total_cost,
    profit_amount,
    employee_percentage,
    employee_profit,
    status
  ) VALUES (
    order_id_input,
    order_record.created_by,
    total_revenue,
    total_cost,
    profit_amount,
    employee_percentage,
    employee_profit,
    'pending'
  )
  ON CONFLICT (order_id) DO UPDATE SET
    total_revenue = EXCLUDED.total_revenue,
    total_cost = EXCLUDED.total_cost,
    profit_amount = EXCLUDED.profit_amount,
    employee_percentage = EXCLUDED.employee_percentage,
    employee_profit = EXCLUDED.employee_profit,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;