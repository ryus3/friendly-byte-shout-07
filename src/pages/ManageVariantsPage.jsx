import React from 'react';
import { Helmet } from 'react-helmet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CategoriesManager from '@/components/manage-variants/CategoriesManager';
import ColorsManager from '@/components/manage-variants/ColorsManager';
import SizesManager from '@/components/manage-variants/SizesManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ManageVariantsPage = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>إدارة المتغيرات - نظام RYUS</title>
        <meta name="description" content="إدارة التصنيفات، الألوان، والقياسات للمنتجات" />
      </Helmet>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/manage-products')}>
              <ArrowRight className="h-4 w-4 ml-2" />
              رجوع
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">إدارة المتغيرات</h1>
            <p className="text-muted-foreground">
              هنا يمكنك إدارة التصنيفات، الألوان، والقياسات لمنتجاتك.
            </p>
          </div>
        </div>
        <Tabs defaultValue="categories" className="w-full" dir="rtl">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="categories">التصنيفات</TabsTrigger>
            <TabsTrigger value="colors">الألوان</TabsTrigger>
            <TabsTrigger value="sizes">القياسات</TabsTrigger>
          </TabsList>
          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <CardTitle>إدارة التصنيفات</CardTitle>
                <CardDescription>إدارة الأقسام الرئيسية، أنواع المنتجات، والمواسم.</CardDescription>
              </CardHeader>
              <CardContent>
                <CategoriesManager />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="colors">
            <ColorsManager />
          </TabsContent>
          <TabsContent value="sizes">
             <Card>
              <CardHeader>
                <CardTitle>إدارة القياسات</CardTitle>
                <CardDescription>إدارة القياسات الحرفية والرقمية.</CardDescription>
              </CardHeader>
              <CardContent>
                <SizesManager />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default ManageVariantsPage;