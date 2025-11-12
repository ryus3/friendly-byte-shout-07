import { Shield, FileText, Phone, ExternalLink } from 'lucide-react';

const TrackingFooter = ({ employee }) => {
  const businessLinks = employee?.business_links || [];

  return (
    <footer className="bg-card border-t-2 border-border mt-8">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* سياسة الخصوصية */}
          <a
            href="#privacy"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <Shield className="w-4 h-4" />
            <span>سياسة الخصوصية</span>
          </a>

          {/* الشروط والأحكام */}
          <a
            href="#terms"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>الشروط والأحكام</span>
          </a>

          {/* تواصل معنا */}
          <a
            href="#contact"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <Phone className="w-4 h-4" />
            <span>تواصل معنا</span>
          </a>
        </div>

        {/* روابط إضافية */}
        {businessLinks.length > 0 && (
          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground mb-2">روابط مفيدة:</p>
            <div className="flex flex-wrap gap-2">
              {businessLinks.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
                >
                  <span>{link.label || `رابط ${index + 1}`}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* حقوق النشر */}
        <div className="text-center mt-6 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} جميع الحقوق محفوظة
          </p>
        </div>
      </div>
    </footer>
  );
};

export default TrackingFooter;
