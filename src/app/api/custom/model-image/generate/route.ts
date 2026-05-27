import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { buildCustomModelPrompt, fileToImageInput, generateCustomModelImage, getDemoReferenceImage } from '@/lib/custom/model-image';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const formData = await request.formData();
    const mainImage = formData.get('mainImage');
    if (!(mainImage instanceof File)) return NextResponse.json({ success: false, error: 'MAIN_IMAGE_REQUIRED' }, { status: 400 });

    const glassesImage = formData.get('glassesImage');
    const hatImage = formData.get('hatImage');
    const prompt = buildCustomModelPrompt({
      extraDescription: String(formData.get('extraDescription') || '').trim(),
      glassesDescription: String(formData.get('glassesDescription') || '').trim(),
      hatDescription: String(formData.get('hatDescription') || '').trim(),
      hasGlassesImage: glassesImage instanceof File,
      hasHatImage: hatImage instanceof File,
    });

    const images = [
      await getDemoReferenceImage(),
      await fileToImageInput(mainImage, 'user-main-photo'),
    ];
    if (glassesImage instanceof File) images.push(await fileToImageInput(glassesImage, 'glasses-reference'));
    if (hatImage instanceof File) images.push(await fileToImageInput(hatImage, 'hat-reference'));

    const result = await generateCustomModelImage({ prompt, images });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[CustomModelImage] Generate failed:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'IMAGE_GENERATION_FAILED' }, { status: 500 });
  }
}
