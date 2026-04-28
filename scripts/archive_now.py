# -*- coding: utf-8 -*-
"""一次性执行归档（无交互确认）"""
import os
import sys
import archive_historical_docs as m

if __name__ == '__main__':
    root = os.getcwd()
    archive = os.path.join(root, 'archive', 'historical-reports', '2025-12')
    m.archive_documents(root, archive, dry_run=False)
    print('ARCHIVE_NOW_DONE')

