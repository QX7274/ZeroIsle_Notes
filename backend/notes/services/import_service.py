from django.core.files import File
from django.core.files.base import ContentFile
import docx
import PyPDF2
from io import BytesIO
from ..models import Note, NoteCategory
from common.utils import get_file_extension

class ImportService:
    """
    笔记导入服务，支持从PDF和Word文档提取内容创建笔记
    """
    SUPPORTED_FORMATS = ['pdf', 'docx']

    @staticmethod
    def import_from_file(file: File, user, category_id=None) -> Note:
        """
        从上传的文件导入笔记
        :param file: 上传的文件对象
        :param user: 笔记所属用户
        :param category_id: 可选，笔记分类ID
        :return: 创建的笔记对象
        ""
        file_ext = get_file_extension(file.name).lower()
        if file_ext not in ImportService.SUPPORTED_FORMATS:
            raise ValueError(f"不支持的文件格式: {file_ext}，仅支持{', '.join(ImportService.SUPPORTED_FORMATS)}")

        # 根据文件格式选择对应的提取方法
        extract_method = ImportService._extract_from_pdf if file_ext == 'pdf' else ImportService._extract_from_docx
        title, content = extract_method(file)

        # 获取分类（如果提供）
        category = None
        if category_id:
            try:
                category = NoteCategory.objects.get(id=category_id, user=user)
            except NoteCategory.DoesNotExist:
                pass

        # 创建笔记
        note = Note.objects.create(
            title=title,
            content=content,
            user=user,
            category=category,
            source_file=file.name
        )

        return note

    @staticmethod
    def _extract_from_pdf(file: File) -> tuple[str, str]:
        """
        从PDF文件提取文本内容
        :param file: PDF文件对象
        :return: (标题, 内容)元组
        ""
        # 读取PDF内容
        pdf_reader = PyPDF2.PdfReader(file)
        content = []

        for page in pdf_reader.pages:
            page_text = page.extract_text()
            if page_text:
                content.append(page_text)

        full_text = '\n\n'.join(content)
        title = file.name.rsplit('.', 1)[0] if '.' in file.name else file.name

        # 尝试从第一页提取标题（如果内容足够长）
        if len(content) > 0 and len(content[0]) > 50:
            potential_title = content[0].split('\n')[0].strip()
            if potential_title and len(potential_title) > 3:
                title = potential_title

        return title, full_text

    @staticmethod
    def _extract_from_docx(file: File) -> tuple[str, str]:
        """
        从Word文档提取文本内容
        :param file: Word文件对象
        :return: (标题, 内容)元组
        ""
        # 读取Word内容
        doc = docx.Document(file)
        content = []

        # 提取标题（优先使用文档中的第一个标题）
        title = file.name.rsplit('.', 1)[0] if '.' in file.name else file.name
        for paragraph in doc.paragraphs:
            if paragraph.style.name.startswith('Heading'):
                if not title:
                    title = paragraph.text.strip()
                content.append(paragraph.text)
            elif paragraph.text.strip():
                content.append(paragraph.text)

        # 如果没有找到标题，使用文件名作为标题
        full_text = '\n'.join(content)
        if not title or title == file.name:
            # 尝试从第一段获取标题
            if len(content) > 0 and len(content[0]) < 100:
                title = content[0].strip()

        return title, full_text

    @staticmethod
    def bulk_import(files, user, category_id=None) -> list[Note]:
        """
        批量导入多个文件
        :param files: 文件对象列表
        :param user: 笔记所属用户
        :param category_id: 可选，笔记分类ID
        :return: 创建的笔记对象列表
        ""
        notes = []
        for file in files:
            try:
                note = ImportService.import_from_file(file, user, category_id)
                notes.append(note)
            except Exception as e:
                # 记录导入失败的文件和原因
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"导入文件 {file.name} 失败: {str(e)}")
                continue
        return notes