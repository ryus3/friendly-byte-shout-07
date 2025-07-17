import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Users } from 'lucide-react';

const ManageEmployeesPage = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>إدارة الموظفين - RYUS</title>
        <meta name="description" content="إدارة صلاحيات وحسابات الموظفين" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button variant="outline" onClick={() => navigate('/settings')}>
              <ArrowRight className="h-4 w-4 ml-2" />
              رجوع للإعدادات
            </Button>
            <div>
              <h1 className="text-3xl font-bold gradient-text">إدارة الموظفين</h1>
              <p className="text-muted-foreground mt-1">عرض وتعديل صلاحيات وحسابات الموظفين</p>
            </div>
          </div>

          {/* Redirect to Full Page */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                إدارة شاملة للموظفين
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                يمكنك إدارة جميع الموظفين وصلاحياتهم من الصفحة المخصصة لذلك
              </p>
              <Button onClick={() => navigate('/manage-employees-full')}>
                الذهاب لإدارة الموظفين
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default ManageEmployeesPage;