import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useBackend } from '../hooks/useBackend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Copy, Eye, Plus, Trash2 } from 'lucide-react';

interface LinkInput {
  url: string;
  text: string;
}

export default function TemplateEditor() {
  const backend = useBackend();
  const { toast } = useToast();

  const [subject, setSubject] = useState('Special Offers Just for You');
  const [links, setLinks] = useState<LinkInput[]>([{ url: '', text: '' }]);
  const [primaryColor, setPrimaryColor] = useState('#007bff');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [fontFamily, setFontFamily] = useState('Arial, sans-serif');
  const [useUnicodeChars, setUseUnicodeChars] = useState(true);
  const [randomizeAttributes, setRandomizeAttributes] = useState(true);
  const [generatedTemplate, setGeneratedTemplate] = useState<string>('');

  const generateTemplateMutation = useMutation({
    mutationFn: () => backend.templates.generate({
      links: links.filter(link => link.url.trim() && link.text.trim()),
      subject,
      customStyles: {
        primaryColor,
        backgroundColor,
        fontFamily,
      },
      spamBypass: {
        useUnicodeChars,
        randomizeAttributes,
      },
    }),
    onSuccess: (data) => {
      setGeneratedTemplate(data.html);
      toast({
        title: "Success",
        description: "Email template generated successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Generate template error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate template.",
        variant: "destructive",
      });
    },
  });

  const addLink = () => {
    setLinks([...links, { url: '', text: '' }]);
  };

  const removeLink = (index: number) => {
    if (links.length > 1) {
      setLinks(links.filter((_, i) => i !== index));
    }
  };

  const updateLink = (index: number, field: keyof LinkInput, value: string) => {
    const updatedLinks = [...links];
    updatedLinks[index][field] = value;
    setLinks(updatedLinks);
  };

  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(generatedTemplate);
      toast({
        title: "Copied",
        description: "Template HTML copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy template.",
        variant: "destructive",
      });
    }
  };

  const previewTemplate = () => {
    if (!generatedTemplate) {
      toast({
        title: "Error",
        description: "No template to preview. Generate a template first.",
        variant: "destructive",
      });
      return;
    }

    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(generatedTemplate);
      newWindow.document.close();
    } else {
      toast({
        title: "Error",
        description: "Failed to open preview window. Please check your popup blocker.",
        variant: "destructive",
      });
    }
  };

  const handleGenerateTemplate = () => {
    const validLinks = links.filter(link => link.url.trim() && link.text.trim());
    
    if (validLinks.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one link with both URL and text.",
        variant: "destructive",
      });
      return;
    }

    generateTemplateMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Template Editor</h1>
        <p className="text-gray-600 mt-2">
          Create email templates with embedded affiliate links and spam bypass features
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Settings</CardTitle>
              <CardDescription>
                Configure your email template settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="subject">Email Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter email subject"
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Affiliate Links</CardTitle>
              <CardDescription>
                Add the affiliate links to include in your template
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {links.map((link, index) => (
                <div key={index} className="space-y-2 p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label>Link {index + 1}</Label>
                    {links.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLink(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <Input
                    value={link.url}
                    onChange={(e) => updateLink(index, 'url', e.target.value)}
                    placeholder="Affiliate URL"
                  />
                  <Input
                    value={link.text}
                    onChange={(e) => updateLink(index, 'text', e.target.value)}
                    placeholder="Button text"
                  />
                </div>
              ))}
              <Button variant="outline" onClick={addLink} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Link
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Styling</CardTitle>
              <CardDescription>
                Customize the appearance of your template
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="primaryColor">Primary Color</Label>
                <Input
                  id="primaryColor"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="mt-1 h-10"
                />
              </div>
              <div>
                <Label htmlFor="backgroundColor">Background Color</Label>
                <Input
                  id="backgroundColor"
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="mt-1 h-10"
                />
              </div>
              <div>
                <Label htmlFor="fontFamily">Font Family</Label>
                <Input
                  id="fontFamily"
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  placeholder="Arial, sans-serif"
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Spam Bypass</CardTitle>
              <CardDescription>
                Configure anti-spam features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="unicodeChars"
                  checked={useUnicodeChars}
                  onCheckedChange={(checked) => setUseUnicodeChars(checked as boolean)}
                />
                <Label htmlFor="unicodeChars">
                  Insert invisible Unicode characters
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="randomizeAttributes"
                  checked={randomizeAttributes}
                  onCheckedChange={(checked) => setRandomizeAttributes(checked as boolean)}
                />
                <Label htmlFor="randomizeAttributes">
                  Randomize HTML attributes
                </Label>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleGenerateTemplate}
            disabled={generateTemplateMutation.isPending}
            className="w-full"
          >
            {generateTemplateMutation.isPending ? 'Generating...' : 'Generate Template'}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Generated Template</CardTitle>
            <CardDescription>
              Your email template HTML code
            </CardDescription>
          </CardHeader>
          <CardContent>
            {generatedTemplate ? (
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={copyTemplate} className="flex-1">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy HTML
                  </Button>
                  <Button variant="outline" onClick={previewTemplate} className="flex-1">
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                </div>
                <Textarea
                  value={generatedTemplate}
                  readOnly
                  className="min-h-96 font-mono text-sm"
                />
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Generate a template to see the HTML code here.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
