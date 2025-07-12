-- Create departments table for main department management
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'Package',
  color TEXT DEFAULT 'from-blue-500 to-blue-600',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Create policies for departments
CREATE POLICY "Authenticated users can view departments" 
ON public.departments 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage departments" 
ON public.departments 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default departments
INSERT INTO public.departments (name, description, icon, color, display_order) VALUES
('قسم الملابس', 'ملابس رجالية ونسائية وأطفال', 'Shirt', 'from-blue-500 to-blue-600', 1),
('قسم الأحذية', 'أحذية متنوعة لجميع الأعمار', 'ShoppingBag', 'from-green-500 to-green-600', 2),
('قسم المواد العامة', 'مواد وأدوات متنوعة', 'Package', 'from-purple-500 to-purple-600', 3);